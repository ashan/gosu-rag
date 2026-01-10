package nz.co.acc.aep.common.history

uses gw.api.database.Query
uses gw.api.database.QuerySelectColumns
uses gw.api.path.Paths

/**
 * Wrapper class for AEP Member History
 */
  class MembershipHistory {
  private var _terms: List<MembershipTerm>
  private var _account : Account

  private construct() {}

  private construct(account: Account, productCode: String, financialYear: Integer) {
    _account = account
    _terms = new ArrayList<MembershipTerm>()
    if (!_account.AEPContractAccount_ACC)
      loadDataForMemberAccount(productCode, financialYear)
    else
      loadDataForMasterAccount(financialYear)
  }

  private function loadDataForMasterAccount(aFinancialYear : Integer) {
    var terms = _account.IssuedPolicies
                  .where(\elt -> elt.ProductCode != "AccreditedEmployersProgramme")
                  .sortBy(\elt -> elt.PeriodStart)
                  .map(\elt -> elt.fetchPolicyPeriod().PolicyTerm)

    if (aFinancialYear != null)
      terms = terms.where(\elt -> elt.AEPFinancialYear_ACC == aFinancialYear)

    setTerms(terms)
  }

  private function loadDataForMemberAccount(aProductCode: String, aFinancialYear: Integer) {
    var query = Query.make(PolicyTerm)
    restrictTermsByACCNumber(query, _account.ACCID_ACC)
    restrictTermsByProductCode(query, aProductCode)
    restrictTermsByFinancialYear(query, aFinancialYear)

    var terms = query.select()
        .orderBy(QuerySelectColumns.path(Paths.make(PolicyTerm#AEPProductCode_ACC)))
        .thenBy(QuerySelectColumns.path(Paths.make(PolicyTerm#AEPACCNumber_ACC)))
        .thenBy(QuerySelectColumns.path(Paths.make(PolicyTerm#AEPFinancialYear_ACC)))
        .toList()

    setTerms(terms)
  }

  private function restrictTermsByACCNumber(query : Query<PolicyTerm>, anACCNumber : String) {
    assert anACCNumber != null : "ACC number cannot be null"

    if (anACCNumber == null)
      return

    query.compare("AEPACCNumber_ACC", Equals, anACCNumber)
  }

  private function restrictTermsByProductCode(query: Query<PolicyTerm>, aProductCode: String) {
    if (aProductCode == null)
      return

    query.compare("AEPProductCode_ACC", Equals, aProductCode)
  }

  private function restrictTermsByFinancialYear(query : Query<PolicyTerm>, aFinancialYear : Integer) {
    if (aFinancialYear == null)
      return

    query.compare("AEPFinancialYear_ACC", Equals, aFinancialYear)
  }

  private function setTerms(terms : List<PolicyTerm>) {
    for(term in terms) {
      var termHistoryItems = new ArrayList<MembershipPeriod>()
      var validPolicyPeriodStatus = {PolicyPeriodStatus.TC_BOUND, PolicyPeriodStatus.TC_AUDITCOMPLETE}
      var validPeriods = term.Periods
                          .where(\period -> validPolicyPeriodStatus.contains(period.Status))
                          .orderBy(\period -> period.EditEffectiveDate)
                          .thenBy(\period -> period.CreateTime)
      for (period in validPeriods) {
        termHistoryItems.add(new MembershipPeriod(period))
      }
      _terms.add(new MembershipTerm(termHistoryItems))
    }
  }

  property get Terms() : List<MembershipTerm> {
    return _terms
  }

  public static function withAllTermsFor(account : Account) : MembershipHistory {
    var memberHistory = new MembershipHistory(account, null, null)
    return memberHistory
  }

  public static function withTermsFor(account : Account,
                                      productCode : String,
                                      financialYear : Integer) : MembershipHistory {
    assert !account.AEPContractAccount_ACC : "This function is only available for member accounts"
    var memberHistory = new MembershipHistory(account, productCode, financialYear)
    return memberHistory
  }

  public static function withTermsFor(account : Account,
                                      financialYear : Integer) : MembershipHistory {
    var memberHistory = new MembershipHistory(account, null, financialYear)
    return memberHistory
  }
}