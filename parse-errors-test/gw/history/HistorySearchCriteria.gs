package gw.history

uses gw.api.database.DBDateRange
uses gw.api.database.IQueryBeanResult
uses gw.api.database.Query
uses gw.api.database.QuerySelectColumns
uses gw.api.database.Relop
uses gw.api.locale.DisplayKey
uses gw.api.path.Paths
uses gw.api.util.DisplayableException
uses gw.search.EntitySearchCriteria
uses entity.Job
uses entity.Activity
uses entity.History

@Export
class HistorySearchCriteria extends EntitySearchCriteria<History> {
  var _fromDate : Date as FromDate
  var _toDate : Date as ToDate
  var _user : User as User
  var _searchRelatedTo : Object as RelatedItem

  /**
   * Creates a query that returns History events matching all of the non-null search criteria
   * fields provided. In other words, the search criteria fields are and-ed together. An exception
   * is thrown if the FromDate and ToDate are both specified but the FromDate is later.
   */
  override protected function doSearch() : IQueryBeanResult<History> {

    var query = Query.make(History)

    if (FromDate != null or ToDate != null)
      query.compare(History#EventTimestamp, new DBDateRange(FromDate, ToDate, true));

    if (User != null)
      query.compare(History#User, Relop.Equals, User);

    if (FromDate != null or ToDate != null)
      query.compare(History#EventTimestamp, new DBDateRange(FromDate, ToDate, true));

    if (User != null) {
      query.compare(History#User, Relop.Equals, User);
    }
    if (RelatedItem typeis Account) {
      query.compare(History#Account, Relop.Equals, RelatedItem);
    } else if (RelatedItem typeis Policy) {
      query.compareIn(History#PolicyTerm, RelatedItem.Periods*.PolicyTerm)
    } else if (RelatedItem typeis PolicyTerm) {
      query.compare(History#PolicyTerm, Relop.Equals, RelatedItem);
    } else if (RelatedItem typeis Job) {
      query.compare(History#Job, Relop.Equals, RelatedItem);
    } else if (RelatedItem typeis PolicyPeriod) {
      query.compare(History#PolicyPeriod, Relop.Equals, RelatedItem);
    } else if (RelatedItem typeis Activity) {
      query.compare(History#Activity, Relop.Equals, RelatedItem);
    } else {
      throw new DisplayableException(DisplayKey.get("Web.History.RelatedToTypeNotSupported"))
    }

    return query.select()
  }


  function getRelatedToSearchCriteriaForAccount(acct : Account) : Object[] {
    var relatedToItems = new ArrayList<Object>()
    relatedToItems.add(acct)
    //relatedToItems.add(acct.AccountHolder)
    for (policy in Policy.finder.findLocalPoliciesByAccount(acct).orderBy(QuerySelectColumns.path(Paths.make(Policy#CreateTime)))) {
      relatedToItems.addAll(getRelatedToSearchCriteriaForPolicy(policy).toList())
    }
    return relatedToItems.toTypedArray()
  }

  function getRelatedToSearchCriteriaForPolicy(policy : Policy) : Object[] {
    var relatedToItems = new ArrayList<Object>()
    relatedToItems.add(policy)  //policy will get converted into policy terms when building the search criteria
    relatedToItems.addAll(policy.Jobs.sort(\j1, j2 -> compareJobs(j1, j2))?.toList() as java.util.Collection<java.lang.Object>) // add the jobs for each policy
    return relatedToItems.toTypedArray()
  }

  function compareJobs(j1 : Job, j2 : Job) : boolean {
    if (j1.CreateTime < j2.CreateTime) {
      return true
    } else if (j1.CreateTime > j2.CreateTime) {
      return false
    } else {
      return (j1.DisplayType < j2.DisplayType)
    }
  }

  function getLevelDisplayString(value : Object) : String {
    if (value typeis Account) {
      return DisplayKey.get("Web.History.AccountLevelNote", value)
    } else if (value typeis Policy) {
      var period = entity.Policy.finder.findPolicyPeriodByPolicyAndAsOfDate(value, Date.Today)
      if (period == null) {
        period = value.Periods.last()
      }
      return DisplayKey.get("Web.History.PolicyLevel", period.PolicyNumber, value.Product.DisplayName)
    } else if (value typeis Job) {
      return getJobDisplayString(value)
    } else if (value typeis PolicyTerm) {
      return getTermDisplayString(value)
    } else if (value typeis AccountHolder) {
      return getAccountHolderString(value)
    } else {
      return DisplayKey.get("Web.History.UnknownLevel")
    }
  }

  private static function getAccountHolderString(accHolder : AccountHolder) : String {
    return DisplayKey.get("Web.History.AccountHolder.AccountLevelNote", accHolder.AccountContact.DisplayName)
  }

  private static function getJobDisplayString(job : Job) : String {
    var effectiveDate = job.LatestPeriod.EditEffectiveDate
    var dateOrStatus = effectiveDate == null ? job.DisplayStatus : effectiveDate as String
    return DisplayKey.get("Web.History.JobLevel", job.DisplayType, job.JobNumber, dateOrStatus)
  }

  private static function getTermDisplayString(term : PolicyTerm) : String {
    return term.CreateTime as String
  }


  override protected property get InvalidSearchCriteriaMessage() : String {
    return null
  }

  override protected property get MinimumSearchCriteriaMessage() : String {
    if (RelatedItem == null) {
      return DisplayKey.get("Web.History.RelatedToIsNull")
    }
    if (FromDate != null and ToDate != null and FromDate > ToDate) {
      return DisplayKey.get("Web.History.FromDateNotBeforeUntilDate")
    }
    return null
  }

}
