package gw.surepath.suite.integration.logging

uses java.io.Serializable
uses java.math.BigDecimal
uses java.text.SimpleDateFormat

uses gw.lang.reflect.features.FeatureReference
uses org.slf4j.MDC
uses entity.KeyableBean
uses dynamic.Dynamic
uses org.apache.commons.lang3.StringEscapeUtils
/**
 * Data class used for serializing the logging contents to JSON. Data from this class is converted into JSON
 * using the Jackson Json engine.
 *
 * NOTE: To provide backwards compatability for Platform v9, had to hand crank the JSON
 *       Orginally was using Dynamic datatype to do this, but that doesnt work in v9
 *
 *
 */
public class LogData implements Serializable{
  public static final var JSON_DATE_PATTERN : String = "yyyyMMdd'T'HHmmss.SSSZ" //ISO 8601 DateFormat
  private static final var QUOTE : String = '"'
  private static final var COMMA : String = ','
  private static final var COLON : String = ':'
  private static final var NULL : String = 'null'
  private static final var CRLF : String = System.lineSeparator()
  //
  private var _timestamp: String as readonly timestamp // needs to be in ISO-8601 format
  private var _message : String as message
  private var _exceptionMessage : String as exceptionMessage
  private var _exceptionClass : String as exceptionClass
  private var _level : String as level
  private var _thread : String as threadName
  private var _application : String as applicationName
  private var _host : String as hostName
  private var _serverVersion : String as serverVersion
  private var _serverId : String as serverId
  private var _serverShardId : String as serverShardId
  private var _userId : String as userId
  private var _class : String as className
  private var _function : String as functionName
  private var _objects : Collection<String> as traceObjects
  private var _contextMap : Map<String, String> as contextMap
  private var _stackTrace: String as stackTrace
  private var _obfusicationKey : String as ObsuicationKey // by default if there is a parmeter in the _contextMap called "encryptionKey" , this key will be used to encrypted any data requiring its use so that it can be decrypted at a later point
  private var _errorCode : String as ErrorCode // this is an optional code that will get stamped into the contextMap on output
  //
  public function stampDate(){
    var dateFormat = new SimpleDateFormat(JSON_DATE_PATTERN)
    _timestamp = dateFormat.format(Date.CurrentDate)
  }
  /**
   * Get the LogData as structured JSON
   * @return JSON representation of LogData
   */
  override public function toString() : String{
    return toJson()
  }

  /**
   * Get the LogData as structured JSON
   * This function only gets the "light" implementation of the String.
   * So very minimal data is output. This is generally used for Trace and Info Levels
   * where you just want to see a message in the logs without all the extra data cluttering the output
   *
   * @return JSON representation of LogData
   */
  public function toStringLight() : String{
    return toJson(true)
  }

  /**
   * Set the class and function name
   * @param method the feature reference with class and function name
  */
  public function setClassAndFunction(method : FeatureReference) {
    if (method != null) {
      var info = method.FeatureInfo
      _class = info.Container.Class.getName()
      _function = info.DisplayName
    }
  }

  public function setClassAndFunction(clazzName : String, methodName : String) {
    if(clazzName == null && methodName == null)
      return
    if(_class == null)
      _class = clazzName
    if(_function == null)
      _function = methodName
  }

  public function isMethodEmpty() : boolean{
    return ((_class == null || _class.isBlank()) && (_function == null || _function.isBlank()))
  }

  /**
   * This function will add an object to the objects list for serialization to log. If your object has PII data
   * inside of it, the object should implement the PIIData interface, so that serialization uses the objects toString()
   * method instead of converting the object to JSON.
   * @param obj object to add to the log. This MUST implement the PIIData interface if it contains PII data.
   * @param asString When the object is not a keyableBean or a BoundPropertyReference, you can pass false to have the entire object serialized or true if you would prefer to have the objects toString() method called. ALWAYS PASS TRUE if there is pii data.
   */
  public function addObject(obj : Object, asString : boolean){
    if(_objects == null)
      _objects = new ArrayList<String>()
    if(obj == null) {
      _objects.add(null)
      return
    }
    if (obj typeis entity.KeyableBean) {
      _objects.add("[${obj.IntrinsicType.DisplayName} = ${obj.PublicID}]")
    } else if (obj typeis gw.lang.reflect.features.BoundPropertyReference) {
      var onm = obj.FeatureInfo.OwnersType.RelativeName
      var pid = (obj.Ctx typeis KeyableBean) ? "(${obj.Ctx.PublicID})" : ""
      var pnm = obj.PropertyInfo.Name
      var pval = obj.PropertyInfo.Accessor.getValue(obj.Ctx).toString()
      _objects.add("[${onm}${pid}#${pnm} = ${pval}]")
    } else {
      var isString = (obj typeis String) // note that we test for String, because if this is already a string, it may be a json object. If that is the case, we dont want to include the type information, just output the actual JSON
      if(asString) {
        _objects.add(isString?obj.toString():"[${obj.Class.Name} = ${obj.toString()}]")
      }else {
        _objects.add(isString?obj.toString():"[${obj.Class.Name} = ${obj.toString()}]")
        }
    }
  }

  /**
   * Add a value to the context variables. Will overwrite anything with the same name. Order you add is preserved for output.
   * If there is a registered obfuscation class inside StructuredLogger then the data will be obfuscated automatically.
   *
   * @param fieldName the name of the field you are adding. Use lowerCamelCase for your variable names.
   * @param value the value of the object. This must be serializable.
   */
  public function addContextValue(fieldName: String, value : Object) {
    if(fieldName == null || fieldName.isEmpty())
      return
    if(_contextMap == null)
      _contextMap = new HashMap<String, String>()
    if(fieldName == StructuredLogger.ERROR_CODE_KEY) // we dont add this value, its a top level citizen in the logging output, the parms are just a convient way to pass it in
      return
    _contextMap.put(fieldName,value == null?null:StructuredLogger.obfuscate(fieldName, value.toString(),getObfuscationKey()))
  }

  /**
   * Overwrite the JSON context map values with whatever is in the MDC context. Note that this will kill any existing data.
   */
  public function setContextValuesAsMDC() {
    var mdc = MDC.getCopyOfContextMap()
    if(mdc == null || mdc.isEmpty()){
      _contextMap = null
      return
    }
    _contextMap = new HashMap<String, String>()
    _contextMap.putAll(mdc)
  }

  /**
   * Copy the MDC context values into the JSON context map.
   */
  public function copyMDCToContextValues() {
    if(_contextMap == null){
      setContextValuesAsMDC()
      return
    }
    var mdc = MDC.getCopyOfContextMap()
    if(mdc == null || mdc.isEmpty())
      return
    if(_contextMap == null)
      _contextMap = new HashMap<String, String>()
    _contextMap.putAll(mdc)
  }

  private function toJson(lightJson : boolean = false):String{
   var map : Map<String, Object>
    if(!lightJson){
      map = {
          "timestamp" -> Date.CurrentDate,
          "errorCode" -> _errorCode,
          "message" -> _message,
          "exceptionMessage" -> _exceptionMessage,
          "exceptionClass" -> _exceptionClass,
          "level" -> _level,
          "threadName" -> _thread,
          "applicationName" -> _application,
          "hostName" -> _host,
          "serverVersion" -> _serverVersion,
          "serverId" -> _serverId,
          "serverShardId" -> _serverShardId,
          "userId" -> _userId,
          "className" -> _class,
          "functionName" -> _function,
          "traceObjects" -> _objects,
          "contextMap" -> _contextMap,
          "stackTrace" -> _stackTrace,
          "elapsedTimeMs" -> StructuredLogger.getElapsedTimeMs()
      }

    }else {
      map = {
          "timestamp" -> Date.CurrentDate,
          "errorCode" -> _errorCode,
          "message" -> _message,
          "serverId" -> _serverId,
          "userId" -> _userId,
          "className" -> _class,
          "functionName" -> _function,
          "elapsedTimeMs" -> StructuredLogger.getElapsedTimeMs()
      }
    }
    return LogData.toJsonString(map,false,true)
  }

  /**
   *
   * @param valuesToOutput This is the name/value pairs of objects you want to put into json.
   * @return returns a formatted json string
   */
  private static function toJsonString(valuesToOutput : Map<String, Object>,prettyJson : boolean = false, omitNulls : boolean = true) : String {
    if(valuesToOutput == null || valuesToOutput.isEmpty())
      return "null"
   var sb = new StringBuilder("{")
    var count = 0
    prettyJson = (prettyJson?!StructuredLogger.isRemoveCRLF():prettyJson)
    valuesToOutput.eachKeyAndValue(\k, val -> {
      if ((k != null && !k.isEmpty())) {
        if ((!omitNulls || (omitNulls && val != null))) {
          count++
          sb.append(count > 1 && prettyJson ? CRLF : "").append(count > 1 ? COMMA : "").append(toJsonValue(k, val))
        }
      }
    })
    sb.append("}")
    if(StructuredLogger.isRemoveCRLF())
      return StructuredLogger.removeCRLF(sb.toString())
    return sb.toString()
  }


  private static function toJsonValue(objName : String,obj : Object) : String {
    if(objName == null || objName.isBlank())
      return null
    var sb = new StringBuilder(QUOTE).append(objName).append(QUOTE).append(COLON).append(" ")
    if(obj == null)
      sb.append("null")
    else {
      if(obj typeis String){
        sb.append(QUOTE).append(toJsonValue(obj)).append(QUOTE)
      }else if(obj typeis Date){
        sb.append(QUOTE).append(toJsonValue(obj)).append(QUOTE)
      }else if(obj typeis Number || obj typeis BigDecimal){
        sb.append(obj.toString())
      }else if(obj typeis Map){
        sb.append(LogData.toJsonValue(obj))
      }else if(obj typeis Collection){
        sb.append(LogData.toJsonValue(obj))
      } else if(obj.getClass().isArray()){
        sb.append(LogData.toJsonValue(obj as Object[]))
      }
    }
    return sb.toString()
  }


  /**
   *
   * Serialize to Json for a given Map of strings
   * @param map object to serialize into Json
   * @return serialized Json Object
   */
  private static function toJsonValue(obj: Map):String{
    if(obj == null || obj.isEmpty())
      return null
    var sb = new StringBuilder("[")
    var count = 0
    obj.eachKeyAndValue(\key, value -> {
      if(!(key == null)){
        var k = key.toString()
        var val = (value==null?null: value.toString())
        count ++
        sb.append(count >1? COMMA : "").append("{").append(QUOTE).append(k).append(QUOTE).append(":").append(val==null?"null":QUOTE).append(val==null?"":toJsonValue(val)).append(val==null?"":QUOTE).append("}")
      }
    })
    sb.append("]")
    return sb.toString()
  }

  /**
   *
   * Serialize to Json for a given Collection of strings
   * @param map object to serialize into Json
   * @return serialized Json Object
   */
  private static function toJsonValue(obj: Collection):String{
    if(obj == null || obj.isEmpty())
      return null
    var sb = new StringBuilder("[")
    var count = 0
    obj.each(\val -> {
        count ++
        sb.append(count > 1 ? COMMA : "").append(val==null?"null":QUOTE).append(val == null ? "" : toJsonValue(val)).append(val==null?"":QUOTE)
    })
    sb.append("]")
    return sb.toString()
  }

  private static function toJsonValue(obj: Object[]):String{
    if(obj == null || obj.isEmpty())
      return null
    var sb = new StringBuilder("[")
    var count = 0
    obj.each(\val -> {
      count ++
      sb.append(count > 1 ? COMMA : "").append(val==null?"null":QUOTE).append(val == null ? "" : toJsonValue(val)).append(val==null?"":QUOTE)
    })
    sb.append("]")
    return sb.toString()
  }

  private static function toJsonValue(obj : Object) : String {
    if(obj == null)
      return "null"
    else {
      if(obj typeis String){
        return (StringEscapeUtils.ESCAPE_JSON.translate(obj))
      }else if(obj typeis Date){
        var dateFormat = new SimpleDateFormat(JSON_DATE_PATTERN)
        return dateFormat.format(obj)
      }else if(obj typeis Number || obj typeis BigDecimal){
        return (obj.toString())
      }else if(obj typeis Map){
        return (LogData.toJsonValue(obj))
      }else if(obj typeis Collection){
        return (LogData.toJsonValue(obj))
      } else if(obj.getClass().isArray()){
        return (LogData.toJsonValue(obj as Object[]))
      }
      return (StringEscapeUtils.ESCAPE_JSON.translate(obj.toString()))
    }
  }


  /**
   * Safely get a value out of the parameter map (context map)
   * @param keyName name of the key you want to get
   * @param defaultValue default value to return if the key isnt part of the map
   * @return the value from the map, or the default value as appropriate
   */
  public function getContextValue(keyName : String, defaultValue : String = null) : String{
    if(_contextMap == null || _contextMap.isEmpty() || !_contextMap.containsKey(keyName))
      return defaultValue
    return _contextMap.get(keyName)
  }

  /**
   * If we are using an obfuscator that supports reversible encryption, what key would it use?
   * @return an obfuscation key to use. If tradeId is not set in the context, then we generate a random, unique key.
   */
  public function getObfuscationKey() : String{
    if(_obfusicationKey != null)
      return _obfusicationKey
    var key = MDC.get(StructuredLogger.ENCRYPTION_KEY)
    if(key == null)
      key = getContextValue("X-B3-TraceId", getContextValue("traceabilityID"))
    if(key == null)
      _obfusicationKey = StructuredLogger.getUUID()
    else
      _obfusicationKey = key
    return _obfusicationKey
  }

}