package gw.bizrules.provisioning.contexts

uses productmodel.PersonalAutoLine

@Export
class PersonalAutoUWContextDefinition extends GenericUWRuleContextDefinition {
  public static final var PARAM_PALINE: String = "personalAutoLine"
  public static final var PARAM_VEHICLES: String = "paVehicles"
  public static final var PARAM_POLICYDRIVERS: String = "paDrivers"
  public static final var PARAM_GARAGELOCATIONS: String = "paGarageLocations"

  construct() {
    addSymbol(PARAM_PALINE, PersonalAutoLine, \ec -> ec.Period.PersonalAutoLine)
    addSymbol(PARAM_VEHICLES, PersonalVehicle[], \ec -> ec.Period.PersonalAutoLine.Vehicles)
    addSymbol(PARAM_POLICYDRIVERS, PolicyDriver[], \ec -> ec.Period.PersonalAutoLine.PolicyDrivers)
    addSymbol(PARAM_GARAGELOCATIONS, PolicyLocation[], \ec -> ec.Period.PersonalAutoLine.GarageLocations)
  }

  override property get Key(): RuleContextDefinitionKey {
    return TC_PAPOLICY
  }

  override function appliesToPolicyLines(lines: typekey.PolicyLine[]): boolean {
    return lines.HasElements and lines.allMatch(\line -> line == TC_PERSONALAUTOLINE)
  }
}