package gw.bizrules.provisioning.contexts

uses typekey.*
uses typekey.PolicyLine

@Export
class BusinessAutoUWContextDefinition extends GenericUWRuleContextDefinition {
  public static final var PARAM_BALINE: String = "commercialAutoLine"
  public static final var PARAM_VEHICLES: String = "baVehicles"
  public static final var PARAM_DRIVERS: String = "baDrivers"

  construct() {
    addSymbol(PARAM_BALINE, BusinessAutoLine, \ec -> ec.Period.BusinessAutoLine)
    addSymbol(PARAM_VEHICLES, BusinessVehicle[], \ec -> ec.Period.BusinessAutoLine.Vehicles)
    addSymbol(PARAM_DRIVERS, CommercialDriver[], \ec -> ec.Period.BusinessAutoLine.Drivers)
  }

  override property get Key(): RuleContextDefinitionKey {
    return TC_BAPOLICY
  }

  override function appliesToPolicyLines(lines: typekey.PolicyLine[]): boolean {
    return lines.HasElements and lines.allMatch(\line -> line == PolicyLine.TC_BUSINESSAUTOLINE)
  }
}