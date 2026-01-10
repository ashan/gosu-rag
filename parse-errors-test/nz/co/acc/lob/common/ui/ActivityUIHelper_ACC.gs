package nz.co.acc.lob.common.ui

uses entity.Activity
uses gw.api.database.IQueryBeanResult
uses gw.api.database.Query
uses gw.api.database.QuerySelectColumns
uses gw.api.database.Relop
uses gw.api.path.Paths

/**
 * UI helper class for Screen Team Activity.
 */
class ActivityUIHelper_ACC {

  private var _subjectSearchKeyword : String as SubjectSearchKeyword

  public var activities : IQueryBeanResult<Activity>as readonly Activities

  public construct() {
  }

  public static function newInstanceForDesktopActivities() : ActivityUIHelper_ACC {
    var helper = new ActivityUIHelper_ACC()
    helper.findActivitiesByUser()
    return helper
  }

  public static function newInstanceForDesktopQueues(): ActivityUIHelper_ACC {
    var helper = new ActivityUIHelper_ACC()
    helper.findActivitiesByQueues()
    return helper
  }

  public function findActivitiesByUser() {
    var user = User.util.CurrentUser
    var query = Query.make(Activity)
    query.compare(Activity#AssignedUser, Relop.Equals, user)
    if (_subjectSearchKeyword != null and _subjectSearchKeyword.HasContent) {
      query.contains(Activity#Subject, _subjectSearchKeyword, true)
    }
    this.activities = query.select()
  }

  /**
   * Based on decompiled GW source com.guidewire.pc.domain.activity.impl.ActivityFinderImpl.class
   *
   * @param queues
   */
  public function findActivitiesByQueues() {
    var queueIDs = getVisibleQueues().map(\queue -> queue.ID)
    var orderBy = QuerySelectColumns.path(Paths.make(entity.Activity#TargetDate))

    var query = Query.make(Activity)
    query.compare(Activity#AssignmentStatus, Relop.Equals, AssignmentStatus.TC_ASSIGNED)
    query.compare(Activity#Type, Relop.NotEquals, ActivityType.TC_ASSIGNMENTREVIEW)
    query.compareIn(Activity#AssignedQueue, queueIDs)
    if (_subjectSearchKeyword != null and _subjectSearchKeyword.HasContent) {
      query.contains(Activity#Subject, _subjectSearchKeyword, true)
    }
    this.activities = query.select().orderBy(orderBy) as IQueryBeanResult<Activity>
  }

  /**
   * Copied from OOTB source DesktopAssignableQueuesLV.pcf
   */
  function getVisibleQueues() : AssignableQueue[] {
    var retValue = new java.util.ArrayList<AssignableQueue>()
    var processor = AssignableQueue.finder.findVisibleQueuesInUserAndAncestorGroups(User.util.CurrentUser) as gw.api.database.IQueryBeanResult<AssignableQueue>
    foreach (i in processor.iterator()) {
      retValue.add(i)
    }
    return retValue?.toTypedArray()
  }
}