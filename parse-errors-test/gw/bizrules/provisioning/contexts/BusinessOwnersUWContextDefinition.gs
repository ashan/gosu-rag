package gw.bizrules.provisioning.contexts

uses typekey.*
uses typekey.PolicyLine

@Export
class BusinessOwnersUWContextDefinition extends GenericUWRuleContextDefinition {
  public static final var PARAM_BOPLINE: String = "businessOwnersLine"
  public static final var PARAM_BOPLOCATIONS: String = "bopLocations"
  public static final var PARAM_BOPBUILDINGS: String = "bopBuildings"

  construct() {
    addSymbol(PARAM_BOPLINE, BusinessOwnersLine, \ec -> ec.Period.BOPLine)
    addSymbol(PARAM_BOPLOCATIONS, BOPLocation[], \ec -> ec.Period.BOPLine.BOPLocations)
    addSymbol(PARAM_BOPBUILDINGS, BOPBuilding[], \ec -> ec.Period.BOPLine.BOPLocations.arrays("Buildings").toArray(new BOPBuilding[0]))
  }

  override property get Key(): RuleContextDefinitionKey {
    return TC_BOPPOLICY
  }

  override function appliesToPolicyLines(lines: typekey.PolicyLine[]): boolean {
    return lines.HasElements and lines.allMatch(\line -> line == PolicyLine.TC_BUSINESSOWNERSLINE)
  }
}