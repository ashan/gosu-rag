package gw.bizrules.provisioning.contexts

@Export
class InlandMarineUWContextDefinition extends GenericUWRuleContextDefinition {
  public static final var PARAM_IMLINE: String = "inlandMarineLine"
  public static final var PARAM_IMLOCATIONS: String = "imLocations"
  public static final var PARAM_IMBUILDINGS: String = "imBuildings"
  public static final var PARAM_CONTRACTORSEQUIPPART: String = "imContractorsEquipPart"
  public static final var PARAM_ACCOUNTSRECPART: String = "imAccountsRecPart"
  public static final var PARAM_IMSIGNPART: String = "imSignPart"

  construct() {
    addSymbol(PARAM_IMLINE, InlandMarineLine, \ec -> ec.Period.IMLine)
    addSymbol(PARAM_IMLOCATIONS, IMLocation[], \ec -> ec.Period.IMLine.IMLocations)
    addSymbol(PARAM_IMBUILDINGS, List<IMBuilding>, \ec -> ec.Period.IMLine.IMBuildings)
    addSymbol(PARAM_CONTRACTORSEQUIPPART, ContractorsEquipPart, \ec -> ec.Period.IMLine.ContractorsEquipPart)
    addSymbol(PARAM_ACCOUNTSRECPART, IMAccountsRecPart, \ec -> ec.Period.IMLine.IMAccountsRecPart)
    addSymbol(PARAM_IMSIGNPART, IMSignPart, \ec -> ec.Period.IMLine.IMSignPart)
  }

  override property get Key(): RuleContextDefinitionKey {
    return TC_IMPOLICY
  }

  override function appliesToPolicyLines(lines: typekey.PolicyLine[]): boolean {
    return lines.HasElements and lines.allMatch(\line -> line == TC_INLANDMARINELINE)
  }
}