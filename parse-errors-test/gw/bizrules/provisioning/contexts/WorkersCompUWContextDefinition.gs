package gw.bizrules.provisioning.contexts

uses productmodel.WorkersCompLine

@Export
class WorkersCompUWContextDefinition extends GenericUWRuleContextDefinition {
  public static final var PARAM_WCLINE: String = "workersCompLine"
  public static final var PARAM_COVEREDEMPLOYEES: String = "wcCoveredEmployees"

  construct() {
    addSymbol(PARAM_WCLINE, WorkersCompLine, \ec -> ec.Period.WorkersCompLine)
    addSymbol(PARAM_COVEREDEMPLOYEES, WCCoveredEmployee[], \ec -> ec.Period.WorkersCompLine.WCCoveredEmployees)
  }

  override property get Key(): RuleContextDefinitionKey {
    return TC_WCPOLICY
  }

  override function appliesToPolicyLines(lines: typekey.PolicyLine[]): boolean {
    return lines.HasElements and lines.allMatch(\line -> line == TC_WORKERSCOMPLINE)
  }
}