package gw.billing

uses entity.AccountContact
uses entity.Contact
uses gw.api.database.Query
uses gw.api.locale.DisplayKey
uses gw.api.productmodel.AuditSchedulePattern
uses gw.api.productmodel.AuditSchedulePatternLookup
uses gw.api.system.PCLoggerCategory
uses gw.api.system.PLDependenciesGateway
uses gw.api.system.bundle.PCNeverPersistedBundle
uses gw.api.util.DisplayableException
uses gw.api.util.LocaleUtil
uses gw.api.util.LocationUtil
uses gw.api.util.MonetaryAmounts
uses gw.api.web.PebblesUtil
uses gw.api.web.WebUtil
uses gw.billing.billingmethod.BillingMethodState
uses gw.billing.billingmethod.BillingMethodStateFactory
uses gw.billing.caching.BillingSubAccountsCache
uses gw.billing.caching.BillingUnappliedFundsCache
uses gw.lang.reflect.IType
uses gw.pl.currency.MonetaryAmount
uses gw.pl.persistence.core.Bundle
uses gw.pl.persistence.core.BundleProvider
uses gw.pl.persistence.core.Key
uses gw.plugin.Plugins
uses gw.plugin.billing.*
uses gw.plugin.billing.impl.StandAloneBillingAccountSearchResult
uses gw.plugin.policyperiod.IPolicyPeriodPlugin
uses gw.transaction.BundleTransactionCallback

uses pcf.BillingAdjustmentPreviewPaymentsPopup
uses pcf.CreatePaymentInstrument
uses pcf.api.Location
uses typekey.Currency

uses java.math.BigDecimal
@Export
/**
 * This class is a helper class for the billing payment page. It provides states and methods that facilitate
 * rendering of the page.
 */
class PolicyPeriodBillingInstructionsManager implements BillingMethodState, PaymentPlansStateContainer, InvoiceStreamStateContainer, UpFrontPaymentStateContainer {

  private static var KANJI_LOCALES = {LocaleType.TC_JA_JP}.freeze()

  /**
   * Allows testing to turn caching on and off for all PolicyPeriodBillingInstructionsManagers.  Data is sometimes reset quickly
   * during testing and this static gives tests the ability to invalidate the caches and prevent race conditions.
   * When using this variable, we recommend wrapping the test in a try block and resetting the variable at the end
   * of the test in a finally block.
   */
  static var _useCaches : boolean as UseCaches = true

  delegate _paymentPlansStateContainer : PaymentPlansStateContainerImpl represents PaymentPlansStateContainer
  delegate _invoiceStreamStateContainer : InvoiceStreamStateContainerImpl represents InvoiceStreamStateContainer
  delegate _upFrontPaymentStateContainer : UpFrontPaymentStateContainerImpl represents UpFrontPaymentStateContainer
  delegate _billingMethodState : BillingMethodState represents BillingMethodState

  var _subAccountsCache : BillingSubAccountsCache
  var _unappliedFundsCache : BillingUnappliedFundsCache

  var _period : PolicyPeriod as PeriodInternal
  var _periodVersionNumber : Integer
  var _billingAccountNumber : String as OwnerBillingAccountNumber
  var _alternateBillerAccountNumber : String as readonly AltBillingAccountNumber
  var _accountContactForBillingID : Key
  var _accountContactForBilling : AccountContact
  var _currency : Currency as PreferredSettlementCurrency

  var _producerCodeOfRecordID : String as ProducerCodeOfRecordID
  var _finalAuditOption : FinalAuditOption as FinalAuditOptionChoice
  var _depositOverridePct : BigDecimal as DepositOverridePct
  var _depositAmount : MonetaryAmount as DepositAmount
  var _totalSubjectToReporting : MonetaryAmount as TotalSubjectToReporting
  var _waiveDepositChange : boolean as WaiveDepositChange
  var _archived : Boolean = null

  var _billingLevel : BillingLevel as BillingLevel

  // When adding Payment Instruments to an account, the user will leave PC before finished editing the Payment Page
  // When finished adding the Payment Instrument, the user will return to the Payment Page and needs their changes
  // preserved.  This flag can be used to prevent the BMSC from resetting before the changes are applied.
  var _ignoreUpdatesUntilSave : boolean as IgnoreUpdatesUntilSave = false

  var _initializing : boolean as Initializing = true

  static function isEditable(period : PolicyPeriod) : boolean {
    return period.Status == TC_QUOTED
  }

  construct() {
    _invoiceStreamStateContainer = new InvoiceStreamStateContainerImpl(this)
    _paymentPlansStateContainer = new PaymentPlansStateContainerImpl(this)
    _subAccountsCache = new BillingSubAccountsCache()
    _unappliedFundsCache = new BillingUnappliedFundsCache()

    _billingMethodState = BillingMethodStateFactory.createBillingMethodState(this)

    SubAccountsCache.setExpireAfterRead(20)
    UnappliedFundsCache.setExpireAfterRead(30)
  }

  private property get SubAccountsCache() : BillingSubAccountsCache {
    if (!UseCaches) {
      invalidateCaches()
    }
    return _subAccountsCache
  }

  private property get UnappliedFundsCache() : BillingUnappliedFundsCache {
    if (!UseCaches) {
      invalidateCaches()
    }
    return _unappliedFundsCache
  }

  /**
   *  Helper method to commit the changes in UI, synchronize the UI with current state of policy period in
   *  bundle and return UI in current state (edit state). This also refreshes the Payment Page with the updates from BC.
   */
  function synchronizeAfterCommit(location : Location) {
    location.commit()
    location.startEditing()
    populateFromPolicyPeriod(_period)
  }

  /**
   * Populate the states of this helper class with the states from the PolicyPeriod.
   *
   * @param period
   */
  final function populateFromPolicyPeriod(period : PolicyPeriod) {
    if (period == null or !period.ValidQuote) return

    try {
      Initializing = true
      if (isSamePeriod(period)
          and (IgnoreUpdatesUntilSave or isUnchanged(period))) {
        return
      }

      _period = period
      _periodVersionNumber = period.BeanVersion
      _producerCodeOfRecordID = period.ProducerCodeOfRecord.PublicID
      _currency = period.PreferredSettlementCurrency
      _finalAuditOption = period.FinalAuditOption
      _depositOverridePct = period.DepositOverridePct
      _billingAccountNumber = period.Policy.Account.AccountNumber
      _alternateBillerAccountNumber = period.AltBillingAccountNumber_ACC
      _waiveDepositChange = period.WaiveDepositChange
      _totalSubjectToReporting = period.TotalSubjectToReporting
      if (WaiveDepositChange) {
        waiveDepositChange()
      } else {
        calculateAndSetDepositAmountOnReporting()
      }
      _billingMethodState = BillingMethodStateFactory.createBillingMethodState(this, period.BillingMethod)
      AccountContactForBilling = period.BillingContact?.AccountContactRole.AccountContact

      if (period.JobProcess.canViewQuote()) {
        if (isEditable(period)) {
          updateAvailablePaymentPlans()
          _paymentPlansStateContainer.initializePaymentPlanFromPeriod(period)
        } else {
          _paymentPlansStateContainer.initializePaymentPlanFromBoundPeriod(period)
        }
      }
      _invoiceStreamStateContainer.populateFromPolicyPeriod(period)
      var downPaymentWithTax = getDownPaymentWithTax()
      if (downPaymentWithTax != null or _depositAmount != null) {
        _upFrontPaymentStateContainer = new UpFrontPaymentStateContainerImpl(_period.Job,
            downPaymentWithTax,
            _depositAmount)
      }

      _billingLevel = Plugins.get(IBillingSystemPlugin).getBillingLevel(BillingAccountNumber)

    } catch(e : Exception) {
      PCLoggerCategory.UI.error("Error in processing: ", e)
      LocationUtil.addRequestScopedErrorMessage(e.LocalizedMessage)
    } finally {
      Initializing = false
    }
  }

  property get Bundle() : Bundle {
    return PeriodInternal.Bundle
  }

  private function getDownPaymentWithTax() : MonetaryAmount {
    var downPayment = InstallmentPlan.DownPayment
    if (downPayment != null) {
      var tax = _period.TaxAndSurchargesRPT
      downPayment += tax
    }
    return downPayment
  }

  private function isSamePeriod(period : PolicyPeriod) : boolean {
    return _period != null
        and _period.ID == period.ID
  }

  /**
   * Explicitly invalidate all the cache. This clears all the cache values before they get expired.
   */
  function invalidateCaches() {
    _paymentPlansStateContainer.invalidateCaches()
    _invoiceStreamStateContainer.invalidateCaches()
    _subAccountsCache.invalidate()
    _unappliedFundsCache.invalidate()
  }

  /**
   * Tells the UI to redraw the given iterator including refreshing the list of items in it
   *
   * @param iteratorType type of iterator to refresh
   */
  function invalidatePCFElementIterators(iteratorType : IType) {
    if (PLDependenciesGateway.getNavigator() != null) {
      PebblesUtil.invalidateIterators(PLDependenciesGateway.getNavigator().getTopLocation(), iteratorType)
    }
  }

  /**
   * No need to update if the provided period is the same version from the same bundle.
   * Due to some issues with pebbles, onEnter() is called multiple times.  This check helps prevent
   * us from making multiple calls to BC to get items, imrpoving performance slightly.
   */
  private function isUnchanged(period : PolicyPeriod) : boolean {
    return _periodVersionNumber == period.BeanVersion
        and _period.Bundle == period.Bundle
  }

  /**
   * If there is a billing contact in the BillingMethodState, then call changeBillingContactTo.
   * If there is no billing contact in the BillingMethodState, then see if there is one in the policy period.  If yes, then call removeBillingContact.
   */
  function saveStateToPolicyPeriod(period : PolicyPeriod) {
    /* When the user clicks on Edit Policy Transaction, the period's status is set to DRAFT and the invoiceStreamOverride values are cleared using clearInvoiceStreamState(),
       In this case, we do not want to call validate().*/
    if(period.Status == PolicyPeriodStatus.TC_QUOTED){
      validate()
    }

    period.BillingMethod = BillingMethod
    period.FinalAuditOption = FinalAuditOptionChoice
    period.AltBillingAccountNumber = AltBillingAccountNumber
    period.InvoicingMethod = InvoicingMethod
    period.WaiveDepositChange = _waiveDepositChange

    _paymentPlansStateContainer.saveStateToPolicyPeriod(period)
    _invoiceStreamStateContainer.saveStateToPolicyPeriod(period)

    period.DepositAmount = _depositAmount

    if (_accountContactForBilling  != null) {
      period.changeBillingContactTo(_accountContactForBilling.Contact)
      period.Bundle.addBundleTransactionCallback(new SetIDBundleTransactionCallback(this, _accountContactForBilling))
    } else if (_accountContactForBillingID != null) {
      var accountContact = period.Bundle.loadBean(_accountContactForBillingID) as AccountContact
      period.changeBillingContactTo(accountContact.Contact)
    } else if (period.BillingContact != null) {
      period.removeBillingContact()
    }

    invalidateCaches()
    validatePolicyContacts(period)
    IgnoreUpdatesUntilSave = false
  }

  /**
   * Validation that happens before save to PolicyPeriod, validation error will throw DisplayableException
   *
   */
  function validate() {
    _invoiceStreamStateContainer.validate()
  }

  /**
   * Waive any changes to the deposit amount for this policy period.
   */
  function waiveDepositChange() {
    _depositOverridePct = _period.BasedOn.DepositOverridePct
    _depositAmount = _period.BasedOn.DepositAmount
  }

  private function updateAvailablePaymentPlans() {
    _paymentPlansStateContainer.updateAvailablePaymentPlans()
    invalidatePCFElementIterators(InstallmentPlanData)
  }

  private function resetPaymentMethod() {
    _paymentPlansStateContainer.resetPaymentMethod()
  }

  property get MissingRequiredAltBillingAccount() : boolean {
    return AlternateBillerRequired and AltBillingAccountNumber == null
  }

  /**
   * Update the defaults of the page according to the current selected billing method and Alt Billing Account.
   * This involves retrieving various information from the Billing System.
   *
   * @param altBillingAccountNumber
   */
  function resetBillingInfo(altBillingAccountNumber : String) {
    _alternateBillerAccountNumber = altBillingAccountNumber
    _billingLevel = Plugins.get(IBillingSystemPlugin).getBillingLevel(BillingAccountNumber)
    updateAvailablePaymentPlans()
    resetPaymentMethod()
    chooseDefaultPaymentPlan()

    _invoiceStreamStateContainer.resetInvoiceStreamsAndPaymentInstruments()
  }

  /**
   * Reset deposit amounts according to the Waive Deposit Change option in the UI.
   */
  function resetDeposit() {
    if (this.WaiveDepositChange) {
      this.waiveDepositChange()
    } else {
      calculateAndSetDepositAmountOnReporting()
    }
  }

  /**
   * Return an array of available payment instruments from BC. It also updates the selected payment instrument
   * if it doesn't exist anymore in BC or it was never selected because there was none available.
   *
   * @return An array of available PaymentInstruments
   */
  function refreshPaymentInstrumentValues() : BillingPaymentInstrument[] {
    return _invoiceStreamStateContainer.refreshPaymentInstrumentValues()
  }

  function getDepositChange() : MonetaryAmount {
    return (_period.PrevDepositAmount == null) ? this.DepositAmountToDisplay : (this.DepositAmountToDisplay - _period.PrevDepositAmount)
  }

  /**
   * Set the Alt Billing Account according to user selection. Also, updates the defatuls according to the selection.
   *
   * @param altBillingAccountNumber
   */
  property set AltBillingAccountNumber(altBillingAccountNumber : String) {
    if (OwnerBillingAccountNumber == altBillingAccountNumber) {
      throw new DisplayableException(DisplayKey.get("Web.Policy.PolicyPeriod.Validation.AltBillingAccountCannotBeOwning"))
    }
    PaymentPlanChoice = null
    /* We need to fork the behavior here because the product requirement for invoice stream overrides is to clear
     * the checkbox on the screen when specifying an AltBillingAccount. However, for Custom Billing this cannot be done
     * because List Bill currently uses Custom Billing without exposing its checkbox on the screen. @Rally("US35822")
     */
    if (InvoicingMethod == typekey.InvoicingMethod.TC_OVERRIDDENINVOICESTREAM) {
      _invoiceStreamStateContainer.selectInvoiceStreamState(typekey.InvoicingMethod.TC_DEFAULTBILLING)
    } else {
    _invoiceStreamStateContainer.clearInvoiceStreamState()
    }

    resetBillingInfo(altBillingAccountNumber)
  }

  /**
   * Calculate the total cost amount of the entire PolicyPeriod, including fees (e.g.: installment fees).
   *
   * @param totalCost
   * @return
   */
  function calculateTotalWithFees(totalCost : MonetaryAmount) : MonetaryAmount {
    return totalCost == null
        ? MonetaryAmounts.zeroOf(_period.PreferredSettlementCurrency)
        : totalCost.add(InstallmentFees)
  }

  /**
   * Updates the suggested amount to pay
   */
  function updateUpFrontPaymentStateContainer() {
    _upFrontPaymentStateContainer?.updateSuggestedAmountToPay(_period.Job,
        getDownPaymentWithTax(),
        _depositAmount)
  }

  /**
   * UI helper method that takes the user to the payment schedule page.
   *
   * @param plan
   */
  function previewPayments(plan: InstallmentPlanData) {
    try {
      var previewItems = RepresentativePolicyPeriod.JobProcess.retrieveInstallmentsPlanPreviewFromBillingSystem(plan)
      BillingAdjustmentPreviewPaymentsPopup.push(plan.Name, previewItems, PeriodInternal)
    } catch (e: Exception) {
      LocationUtil.addRequestScopedErrorMessage(DisplayKey.get("Web.BillingAdjustmentsDV.Error.RetrieveInstallmentsPlanPreview", e.Message))
      PCLoggerCategory.BILLING_SYSTEM_PLUGIN.error(e.Message)
    }
  }

  /**
   * Populate various UI fields based on the reporting plan selected.
   */
  function setFieldsFromNewReportingPlan() {
    var auditSchedulePattern = AuditSchedulePatternLookup.selectByPublicID(ReportingPlanChoice.ReportingPatternCode)
    var defaultDepositPercent = auditSchedulePattern.ReportingDefaultDepositPct
    FinalAuditOptionChoice = FinalAuditOption.TC_YES
    DepositAmount = this.TotalSubjectToReporting * defaultDepositPercent / 100
    DepositOverridePct = null
  }

  property set BillingMethodType(type : BillingMethod) {
    _billingMethodState.updateBillingMethodType(type)
  }

  property set BillingMethodState(billingMethodState : BillingMethodState) {
    _billingMethodState = billingMethodState
  }

  property get HasAccountContactForBilling() : boolean {
    return _accountContactForBilling != null or _accountContactForBillingID != null
  }

  property get DisplayAccountUnappliedOrExisting() : String {
    return _invoiceStreamStateContainer.DisplayAccountUnappliedOrExisting
  }

  property get NewUnappliedFund() : boolean {
    return _invoiceStreamStateContainer.NewUnappliedFund
  }

  property set NewUnappliedFund(isNewUnapplied : boolean) {
    _invoiceStreamStateContainer.NewUnappliedFund = isNewUnapplied
  }

  function invoicingOptionChanged() {
    _invoiceStreamStateContainer.invoicingOptionChanged()
  }

  property get EmptyInvoiceStreamsDescriptions() : String[] {
    return { DisplayKey.get("Web.Policy.Payment.NoInvoiceStreamsLV.CreatedByBilling") }
  }

  property get HasPendingPaymentGatewayTransactions() : boolean {
    return _upFrontPaymentStateContainer != null and
        _upFrontPaymentStateContainer?.hasPendingPaymentGatewayTransactions(_period)
  }

  public property set AccountContactForBilling(contact : AccountContact) {
    if (contact == null) {
      _accountContactForBilling = null
      _accountContactForBillingID = null
    } else if (contact.ID.Temporary) {
      _accountContactForBilling = contact
      _accountContactForBillingID = null
    } else {
      _accountContactForBilling = null
      _accountContactForBillingID = contact.ID
    }
  }

  public property set AccountContactForBillingID(contact : Key) {
    _accountContactForBillingID = contact
  }

  /**
   * The reporting audit schedule pattern for this policy period.
   */
  property get AuditSchedulePattern() : AuditSchedulePattern {
    return AuditSchedulePatternLookup.selectByPublicID(ReportingPlanChoice.ReportingPatternCode)
  }

  property get AvailableBillingMethods() : BillingMethod[] {
    try {
      var supportedMethods = PossibleBillingMethods
      if (supportedMethods.Count == 1) {
        BillingMethodType = supportedMethods.first()
      }

      return supportedMethods
    } catch (e: Exception) {
      LocationUtil.addRequestScopedErrorMessage(DisplayKey.get("Web.BillingAdjustmentsDV.Error.RetrieveBillingMethods"))
      PCLoggerCategory.BILLING_SYSTEM_PLUGIN.error(e.Message)
      BillingMethodType = null
      return new BillingMethod[0]
    }
  }

  property set DepositOverridePct(value : BigDecimal) {
    _depositOverridePct = value
    WaiveDepositChange = false
    this.calculateAndSetDepositAmountOnReporting()
  }

  property get DepositAmountToDisplay() : MonetaryAmount {
    return DepositAmount == null ? 0bd.ofCurrency(PreferredSettlementCurrency) : DepositAmount
  }

  /**
   * Calculate and set the deposit amount for this policy period
   *    based on the total subject to reporting and override percent.
   *    Copied from PolicyPeriodBillingEnhancement
   */
  function calculateAndSetDepositAmountOnReporting() : MonetaryAmount {
    var depositAmt : MonetaryAmount
    if (TotalSubjectToReporting != null and DepositOverridePct != null) {
      depositAmt = this.TotalSubjectToReporting * this.DepositOverridePct / 100
    } else if (TotalSubjectToReporting != null and ReportingDefaultDepositPct != null) {
      depositAmt = TotalSubjectToReporting * ReportingDefaultDepositPct / 100
    } else {
      depositAmt = null
    }
    if (depositAmt != null) {
      DepositAmount = MonetaryAmounts.roundToCurrencyScale(depositAmt.Amount, depositAmt.Currency, HALF_EVEN)
    } else {
      DepositAmount = _period.DepositAmount
    }
    return DepositAmount
  }

  /**
   * Returns an array of available billing methods for this policy period.
   *
   * If the producer code of record does not support the given currency, BC returns null.  However, we always add
   * List Bill to the list of supported billing methods.
   *
   * If the producer code of record is not found in BC, it throws an exception. Since this method is to provide
   * values for the UI, we'll default to returning ALL the billing methods so the UI can proceed as expected.
   * We expect that validation will ensure that an only a valid producer code and currency will be set before the
   * policy is allowed to bind.
   */
  private property get PossibleBillingMethods(): BillingMethod[] {
    var supportedMethods = BillingMethod.AllTypeKeys.toTypedArray()
    try {
      var policyPeriodPlugin = Plugins.get(IPolicyPeriodPlugin)
      supportedMethods = policyPeriodPlugin.getSupportedBillingMethods()
      if (supportedMethods.Count > 1) {
        var bcBillingMethods = Plugins.get(IBillingSystemPlugin).getAvailableBillingMethods(ProducerCodeOfRecordID, PreferredSettlementCurrency)
        supportedMethods = supportedMethods.where(\b -> bcBillingMethods.contains(b))
      }
    } catch (e : Exception) {
      PCLoggerCategory.BILLING_SYSTEM_PLUGIN.error("Could not get supported billing methods", e)
    }

    return supportedMethods
  }

  property get SubAccounts() : BillingAccountSearchResult[] {
    try {
      var subAccounts = SubAccountsCache.getSubAccounts(OwnerBillingAccountNumber)
      subAccounts = _billingMethodState.filterAccountsForBillingMethodType(subAccounts)
      if (subAccounts.IsEmpty) {
        return {createEmptyIndicatorSubAccountSearchResult()}
      }
      return subAccounts
    } catch (e: Exception) {
      LocationUtil.addRequestScopedErrorMessage(DisplayKey.get("Web.BillingAdjustmentsDV.Error.RetrieveSubAccounts"))
      return {}
    }
  }

  private function createEmptyIndicatorSubAccountSearchResult(): BillingAccountSearchResult {
    return new StandAloneBillingAccountSearchResult() {
      : AccountNumber = "",
      : AccountName = DisplayKey.get("Web.Policy.Billing.NoSubAccounts")
    }
  }

  /**
   * The unapplied funds for the Billing Account
   */
  property get UnappliedFunds() : BillingUnappliedFundInfo[] {
    if (BillingAccountNumber == null or BillingAccountNumber.isEmpty()) {
      return {}
    }
    try {
      return UnappliedFundsCache.retrieveAccountUnappliedFunds(BillingAccountNumber, this.PreferredSettlementCurrency)
    } catch (e: Exception) {
      LocationUtil.addRequestScopedErrorMessage(DisplayKey.get("Web.BillingAdjustmentsDV.Error.RetrieveSubAccounts"))
      return {}
    }
  }

  property get UpFrontPaymentsVisible() : boolean {
    return _upFrontPaymentStateContainer != null
  }

  function getOrCreateAccountContact(contact : Contact, account : Account) : AccountContact {
    var accountContact = account.maybeAddNewAccountContact(contact)
    AccountContactForBilling = accountContact
    return accountContact
  }

  function getAccountContactForBilling(entity : BundleProvider) : AccountContact {
    if (entity == null or !HasAccountContactForBilling) {
      return null;
    }

    if (_accountContactForBilling != null) {
        return _accountContactForBilling
    }

    return entity.Bundle.loadBean(_accountContactForBillingID) as AccountContact
  }

  function getBillingContacts(account : Account) : AccountContact[] {
    var accountContacts = account.getAccountContactsWithRole(typekey.AccountContactRole.TC_BILLINGCONTACT)
    var accountToBeSubtracted = getAccountContactForBilling(account)
    if (accountToBeSubtracted != null) {
      accountContacts = accountContacts.subtract(new AccountContact[] {accountToBeSubtracted}).toTypedArray()
    }

    return accountContacts
  }

  function getNonBillingContacts(account : Account) : AccountContact[] {
    var accountContacts = account.ActiveAccountContacts.subtract(getBillingContacts(account))
    var accountContactForBilling = getAccountContactForBilling(account)
    if (accountContactForBilling != null) {
      accountContacts = accountContacts.subtract({accountContactForBilling})
    }
    return accountContacts.toTypedArray() as AccountContact[]
  }

  //this was copied in from EditPolicyContactRolePopup.pcf
  function validatePolicyContacts(policyPeriod : PolicyPeriod) {
    gw.validation.PCValidationContext.doPageLevelValidation( \ context -> {
      for (line in policyPeriod.Lines) {
        for (policyAddlInsured in line.AdditionalInsureds) {
          var addlInsuredValidator = new gw.policy.PolicyAddlInsuredAndTypeUniqueValidation(context, policyAddlInsured)
          addlInsuredValidator.validate()
        }
      }
      // Check to make sure the user didn't delete the policy address
      var validator = new gw.policy.PolicyPeriodValidation(context, policyPeriod  )
      validator.checkPolicyAddress()
    })
  }

  function externalPaymentLocation(policyPeriod : PolicyPeriod) : pcf.api.Location {
    IgnoreUpdatesUntilSave = true
    invalidateCaches()

    var billingContact = getAccountContactForBilling(policyPeriod)

    var accountHolderName = billingContact.DisplayName ?: ""
    var address = billingContact.Contact.PrimaryAddress

    var add1 = address.AddressLine1 ?: ""
    var add2 = address.AddressLine2 ?: ""
    var city = address.City ?: ""
    var state = address.State.Code ?: ""
    var zip = address.PostalCode ?: ""

    //For the simple demo setup, the demo payment system runs alongside PolicyCenter on the same server, using the config.xml PaymentSystemURL parameter
    //Normally the the payment system would be on a separate physical computer from PolicyCenter.
    var baseURL = WebUtil.BasePath

    var paymentURL = baseURL //gw.api.system.PCConfigParameters.PaymentSystemURL.Value

    //For a real-world customer environment, CHANGE THE RETURN URL to the PolicyCenter URL that is commented out on the next line:
    var returnURL = baseURL //gw.plugin.Plugins.get(gw.plugin.webconfig.IPolicyCenterWebConfigPlugin).PolicyCenterURL

    return CreatePaymentInstrument.push(paymentURL, returnURL, policyPeriod.Job.JobNumber, BillingAccountNumber, accountHolderName, add1, add2, city, state, zip)
  }

  function midtermEditMode(inEdit: boolean) : String{
    if (inEdit) {
      if (ReportingPlanSelected)
        return "MidtermReporting"
      else
        return "MidtermInstallments"
    }
    else {
      if (ReportingPlanSelected)
        return "MidtermReportingReadOnly"
      else
        return "MidtermInstallmentsReadOnly"
    }
  }

  function midtermAuditEditMode(inEdit: boolean) : String{
    if (inEdit) {
      if (ReportingPlanSelected) {
        return "MidtermReporting"
      } else {
        return "MidtermInstallments"
      }
    }
    return "ReadOnly"
  }

  function upFrontPaymentEditMode(inEdit : boolean) : String {
    return (inEdit and !Archived) ? 'Editable' : 'ReadOnly'
  }

  static function formatAccount(accountNumber: String): String {
    var result = Query.make(Account).compare(Account#AccountNumber, Equals, accountNumber).select()
    if (!result.Empty) {
      return accountNumber + " (" + result.FirstResult.AccountHolderContact.DisplayName + ")"
    }
    return accountNumber
  }

  static function showKanjiFields(): boolean {
    return KANJI_LOCALES.contains(LocaleUtil.getCurrentUserLocale())
  }

  private static class SetIDBundleTransactionCallback implements BundleTransactionCallback {
    private var _policyPeriodBillingInstructionsManager: PolicyPeriodBillingInstructionsManager
    private var accountContact : AccountContact

    construct(billingMethod : PolicyPeriodBillingInstructionsManager, newAccountContact : AccountContact) {
      _policyPeriodBillingInstructionsManager = billingMethod
      accountContact = newAccountContact
    }

    override function afterCommit(bundle: Bundle, commitSucceeded: boolean) {
      if (commitSucceeded) {
        _policyPeriodBillingInstructionsManager._accountContactForBilling = null
        _policyPeriodBillingInstructionsManager.AccountContactForBillingID = accountContact?.ID
      }
    }

    override function beforeCommit(bundle: Bundle) {}
    override function afterPreUpdate(bundle: Bundle) {}
    override function beforeSearchDenormObjects(bundle: Bundle) {}
    override function afterSearchDenormObjects(bundle: Bundle) {}
    override function afterValidation(bundle: Bundle) {}
    override function afterSetIds(bundle: Bundle) {}
    override function afterWriteToDatabase(bundle: Bundle) {}
  }

  /**
   * Filters the Payment Instruments (EFT/ACH is not used) and adds the 'Other' option
   */
  function retrieveAvailablePaymentInstrumentsForUpFrontPayment() : List<String> {
    var aux = new ArrayList<String>()
    var instruments = _invoiceStreamStateContainer.retrieveAvailablePaymentInstruments()
    instruments?.each( \ elt -> {
      if(not AccountPaymentMethod.TF_WONTUSEPAYMENTMETHODS.TypeKeys.contains(elt.PaymentMethod)){
        aux.add(elt.DisplayName)
      }
    })
    aux.add(DisplayKey.get('Web.UpFrontPaymentDV.Other'))
    return aux
  }

  /**
   * Returns true if the period is archived in the Billing System, otherwise false.
   */
  property get Archived() : boolean {
    if (_archived != null) {
      return _archived
    }

    var periodToCheck = PeriodInternal
    if (periodToCheck.Status != TC_BOUND and periodToCheck.BasedOn != null) {
      periodToCheck = PeriodInternal.BasedOn
    }
    try {
      _archived = periodToCheck.IsArchivedInBillingSystem
    } catch (ex : Exception) {
      // If there's an exception, we just assume it's not archived. Validation will be performed again when the
      // PolicyPeriod is bound.
      // User will need to get out of the wizard and back in if he/she wants to refresh the Archived property.
      _archived = false
    }
    return _archived
  }

  /**
   * Provides a copy of the original PolicyPeriod with the on-screen changes applied.  This Period will be in a different
   * bundle and will cause a CDC on-screen if committed.  Changes are expected to be thrown away.
   * @return PolicyPeriod
   */
  protected property get RepresentativePolicyPeriod() : PolicyPeriod {
    var tempPolicyPeriod = new PCNeverPersistedBundle().loadBean(_period.ID) as PolicyPeriod
    var tempIgnore = IgnoreUpdatesUntilSave
    saveStateToPolicyPeriod(tempPolicyPeriod)
    IgnoreUpdatesUntilSave = tempIgnore
    return tempPolicyPeriod
  }

  function resetNewInvoicing() {
    _invoiceStreamStateContainer.NewInvoicing = false
  }

  property get DownPaymentPreviewIconVisible() : boolean {
    return InstallmentPlan != null and hasNonZeroValue(InstallmentPlan.DownPayment) and hasNonZeroValue(InstallmentPlan.Tax)
  }

  property get InstallmentPreviewIconVisible() : boolean {
    return InstallmentPlan != null and hasNonZeroValue(InstallmentPlan.Installment) and hasNonZeroValue(InstallmentPlan.Fee)
  }

  property get SpecialHandlingAvailable() : boolean {
    return gw.plugin.Plugins.get(gw.plugin.billing.IBillingSystemPlugin).supportsSpecialHandlingForChangeInCost()
        and PeriodInternal.ChangeInTotalCostRPT.IsNotZero
  }

  property get OverridingBillingAllocationAvailable() : boolean {
    return not gw.plugin.Plugins.get(gw.plugin.billing.IBillingSystemPlugin).supportsSpecialHandlingForChangeInCost()
        and PeriodInternal.ChangeInTotalCostRPT.IsNotZero
  }

  private function hasNonZeroValue(amount : MonetaryAmount) : boolean {
    return amount != null and amount.IsNotZero
  }
}

