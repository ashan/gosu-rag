package gw.api.util

uses gw.api.assignment.UserAssignee
uses gw.api.assignment.multicluster.LocationObjectSearchUtil
uses gw.api.assignment.multicluster.MulticlusterAssignableQueueUtilBase
uses gw.api.assignment.multicluster.MulticlusterAssignee
uses gw.api.web.desktop.data.FederatedActivityAssignmentHelper
uses gw.api.web.desktop.data.FederatedDataUIHelper
uses gw.api.web.desktop.data.activity.ActivityDTO
uses gw.lang.reflect.IType
uses pcf.api.Location

uses LocationObjectSearchUtil#findByType(Location, IType)
uses LocationObjectSearchUtil#findByType(Location, IType, String)

uses entity.Activity

@Export
class MulticlusterAssignableQueueUtil extends MulticlusterAssignableQueueUtilBase {

  final var _activityAssignmentHelper : FederatedActivityAssignmentHelper

  final static var DEFAULT_INSTANCE : MulticlusterAssignableQueueUtil as readonly Instance  = new MulticlusterAssignableQueueUtil()

  construct(federatedActivityAssignmentHelper : FederatedActivityAssignmentHelper) {
    _activityAssignmentHelper = federatedActivityAssignmentHelper
  }

  construct() {
    this(new FederatedActivityAssignmentHelper())
  }

  function assignFirstActivity(location : pcf.api.Location): String {
    var activities = findActivities(location, "Java.Error.AssignableQueue.AssignFirstFailed")
    var activity = activities.limit(1)
    assignActivitiesFromQueue(activity)
    return activity[0].PublicId
  }

  function assignActivitiesFromQueue(activities : ActivityDTO[]) {
    if (activities == null || activities.length == 0) {
      return
    }
    var activityDtos = activities as ActivityDTO[]
    var activitiesByCluster = _activityAssignmentHelper.activitiesByCluster(activityDtos)
    var activitiesCollection = activitiesByCluster.values().flatten().toCollection()
    var activityQueueMapping = mapActivitiesToQueues(activitiesCollection)
    checkPermissions(activityQueueMapping.values().toSet())
    _activityAssignmentHelper.performAssignment(activitiesByCluster, \activity : ActivityDTO ->
        currentUserAssigne(activityQueueMapping.get(activity.PublicId))
    )
  }

  static function isSelectedQueueEmpty(location : pcf.api.Location) : boolean {
    var activities = findActivities(location)
    return activities.length == 0
  }

  private static function findActivities(location : pcf.api.Location) : Object[] {
    if (FederatedDataUIHelper.IsDefault) {
      return findByType(location, Activity.TYPE.get())
    } else if (FederatedDataUIHelper.IsFederated) {
      return findByType(location, ActivityDTO.Type)
    } else {
      throw new IllegalArgumentException("Unsupported mode: " + FederatedDataUIHelper.mode())
    }
  }

  private static function findActivities(location : pcf.api.Location, errorMessageCode : String) : ActivityDTO[] {
    return findByType(location, ActivityDTO.Type, errorMessageCode) as ActivityDTO[]
  }

  private static function currentUserAssigne(queue : AssignableQueue) : MulticlusterAssignee {
    var currentUser = User.util.CurrentUser
    var group = findGroupToAssignTo(currentUser, queue)
    var userAssigne = new UserAssignee(group, currentUser)
    return new MulticlusterAssignee.Builder(userAssigne)
        .withUserId(currentUser.PublicID)
        .withGroupId(group.PublicID)
        .build()
  }

  private static function mapActivitiesToQueues(activities : Collection<ActivityDTO>) : Map<String, AssignableQueue> {
    var queues = AssignableQueue.finder.findVisibleQueuesInUserAndAncestorGroups(User.util.CurrentUser) as gw.api.database.IQueryBeanResult<AssignableQueue>
    var queuesMap = queues.mapToKeyAndValue(\q -> q.PublicID, \q -> q)
    return activities.mapToKeyAndValue(\a -> a.PublicId, \a -> queuesMap.get(a.QueueId))
  }

  private static function findGroupToAssignTo(assignTo : User, queue : AssignableQueue) : Group {
    var groups = assignTo.getAllGroups() as Set<Group>
    return groups.singleWhere(\group -> queue.Group.isAncestor(group))
  }
}