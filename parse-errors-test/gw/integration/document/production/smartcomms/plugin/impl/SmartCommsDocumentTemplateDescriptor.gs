package gw.integration.document.production.smartcomms.plugin.impl

uses gw.i18n.ILocale
uses gw.lang.parser.ISymbolTable
uses gw.lang.reflect.IType
uses gw.lang.reflect.gs.IGosuProgram
uses gw.plugin.document.IDocumentTemplateDescriptor
uses gw.plugin.document.production.dto.DocumentTemplate

/**
 * Smart Comms implementation of document template descriptor.
 */
@Export
class SmartCommsDocumentTemplateDescriptor implements IDocumentTemplateDescriptor {

  static final var DATEEFFECTIVE_PROP = "dateeffective"
  static final var DATEEXPIRES_PROP = "dateexpires"
  static final var DATEMODIFIED_PROP = "datemodified"
  static final var DEFAULTSECURITYTYPE_PROP = "defaultsecuritytype"
  static final var DESCRIPTION_PROP = "description"
  static final var DOCUMENTPRODUCTIONTYPE_PROP = "productiontype"
  static final var IDENTIFIER_PROP = "identifier"
  static final var KEYWORDS_PROP = "keywords"
  static final var MIMETYPE_PROP = "mimetype"
  static final var NAME_PROP = "name"
  static final var PASSWORD_PROP = "password"
  static final var REQUIREDPERMISSION_PROP = "requiredpermission"
  static final var SCOPE_PROP = "scope"
  static final var TEMPLATEID_PROP = "templateid"
  static final var TYPE_PROP = "type"

  var _metadata = new HashMap<String, Object>()
  var _formFieldNames : String[]
  var _locale: ILocale

  construct(){}

  construct(template: DocumentTemplate, locale: ILocale) {
    TemplateId = template.TemplateID
    Name = template.Name
    DateEffective = template.EffectiveDate
    DateExpiration = template.ExpirationDate
    Description = template.Description
    Keywords = template.Keywords
    DocumentProductionType = template.ProductionType
    MimeType = template.MimeType
    Scope = template.Scope
    _formFieldNames = {TEMPLATEID_PROP, NAME_PROP, TYPE_PROP, DATEMODIFIED_PROP, DATEEFFECTIVE_PROP, DATEEXPIRES_PROP}
    _locale = locale
  }

  override property get DateEffective() : Date  {
    return _metadata.get(DATEEFFECTIVE_PROP) as Date
  }

  property set DateEffective(value : Date)  {
    _metadata.put(DATEEFFECTIVE_PROP, value)
  }

  override property get DateExpiration() : Date  {
    return _metadata.get(DATEEXPIRES_PROP) as Date
  }

  property set DateExpiration(value : Date)  {
    _metadata.put(DATEEXPIRES_PROP, value)
  }

  override property get DateModified() : Date  {
    return _metadata.get(DATEMODIFIED_PROP) as Date
  }

  override property set DateModified(value : Date)  {
    _metadata.put(DATEMODIFIED_PROP, value)
  }

  override property get DefaultSecurityType() : String  {
    return _metadata.get(DEFAULTSECURITYTYPE_PROP) as String
  }

  property set DefaultSecurityType(value : String)  {
    _metadata.put(DEFAULTSECURITYTYPE_PROP, value)
  }

  override property get Description() : String  {
    return _metadata.get(DESCRIPTION_PROP) as String
  }

  override function getDescription(iLocale: ILocale): String {
    return null
  }

  property set Description(value : String)  {
    _metadata.put(DESCRIPTION_PROP, value)
  }

  override property get DocumentProductionType() : String  {
    return _metadata.get(DOCUMENTPRODUCTIONTYPE_PROP) as String
  }

  property set DocumentProductionType(value : String)  {
    _metadata.put(DOCUMENTPRODUCTIONTYPE_PROP, value)
  }

  override property get Identifier() : String  {
    return _metadata.get(IDENTIFIER_PROP) as String
  }

  property set Identifier(value : String)  {
    _metadata.put(IDENTIFIER_PROP, value)
  }

  override property get Keywords() : String[]  {
    return _metadata.get(KEYWORDS_PROP) as String[]
  }

  property set Keywords(value : String[])  {
    _metadata.put(KEYWORDS_PROP, value)
  }

  override property get MimeType() : String  {
    return _metadata.get(MIMETYPE_PROP) as String
  }

  property set MimeType(value : String)  {
    _metadata.put(MIMETYPE_PROP, value)
  }

  override property get Name() : String  {
    return _metadata.get(NAME_PROP) as String
  }

  property set Name(value : String)  {
    _metadata.put(NAME_PROP, value)
  }

  override property get Password() : String  {
    return _metadata.get(PASSWORD_PROP) as String
  }

  property set Password(value : String)  {
    _metadata.put(PASSWORD_PROP, value)
  }

  override property get RequiredPermission() : String  {
    return _metadata.get(REQUIREDPERMISSION_PROP) as String
  }

  property set RequiredPermission(value : String)  {
    _metadata.put(REQUIREDPERMISSION_PROP, value)
  }

  override property get Scope() : String  {
    return _metadata.get(SCOPE_PROP) as String
  }

  property set Scope(value : String)  {
    _metadata.put(SCOPE_PROP, value)
  }

  override property get TemplateId() : String  {
    return _metadata.get(TEMPLATEID_PROP) as String
  }

  property set TemplateId(value : String)  {
    _metadata.put(TEMPLATEID_PROP, value)
  }

  override property get TemplateType() : String  {
    return _metadata.get(TYPE_PROP) as String
  }

  property set TemplateType(value : String)  {
    _metadata.put(TYPE_PROP, value)
  }

  override property get MetadataPropertyNames() : String[]  {
    return _metadata.keySet().toTypedArray()
  }

  override function getMetadataPropertyValue(propertyName : String) : Object  {
    return _metadata.get(propertyName)
  }

  override property get ContextObjectNames() : String[]  {
    return new String[0]
  }

  override function getContextObjectAllowsNull(objectName : String) : boolean  {
    return true
  }

  override function getContextObjectDefaultValueExpression(objectName : String) : String  {
    return null
  }

  override function getCompiledContextObjectDefaultValueExpression(iSymbolTable: ISymbolTable, s: String): IGosuProgram {
    return null
  }

  override function getContextObjectDisplayName(objectName : String) : String  {
    return null
  }

  override function getContextObjectPossibleValuesExpression(objectName : String) : String  {
    return null
  }

  override function getCompiledContextObjectPossibleValuesExpression(iSymbolTable: ISymbolTable, s: String): IGosuProgram {
    return null
  }

  override function getContextObjectType(objectName : String) : String  {
    return null
  }

  override function getContextObjectIType(s: String): IType {
    return null
  }

  override property get FormFieldNames() : String[]  {
    return _formFieldNames
  }

  override function getFormFieldDisplayValue(fieldName : String, value : Object) : String  {
    return value?.toString()
  }

  override function getFormFieldValueExpression(fieldName : String) : String  {
    return null
  }

  override function getFormFieldCompiledExpression(iSymbolTable: ISymbolTable, s: String): IGosuProgram {
    return null
  }

  override function getName(p0: ILocale): String {
    return Name
  }

  override property get Locale(): ILocale {
    return _locale
  }

  override property get Language(): ILocale {
    return _locale
  }
}