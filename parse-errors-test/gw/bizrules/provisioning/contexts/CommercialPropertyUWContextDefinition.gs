package gw.bizrules.provisioning.contexts

@Export
class CommercialPropertyUWContextDefinition extends GenericUWRuleContextDefinition {
  public static final var PARAM_CPLINE: String = "commercialPropertyLine"
  public static final var PARAM_CPLOCATIONS: String = "cpLocations"
  public static final var PARAM_CPBUILDINGS: String = "cpBuildings"

  construct() {
    addSymbol(PARAM_CPLINE, CommercialPropertyLine, \ec -> ec.Period.CPLine)
    addSymbol(PARAM_CPLOCATIONS, CPLocation[], \ec -> ec.Period.CPLine.CPLocations)
    addSymbol(PARAM_CPBUILDINGS, CPBuilding[], \ec -> ec.Period.CPLine.CPLocations.arrays("Buildings").toArray(new CPBuilding[0]))
  }

  override property get Key(): RuleContextDefinitionKey {
    return TC_CPPOLICY
  }

  override function appliesToPolicyLines(lines: typekey.PolicyLine[]): boolean {
    return lines.HasElements and lines.allMatch(\line -> line == TC_COMMERCIALPROPERTYLINE)
  }
}