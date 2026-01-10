package gw.bizrules.provisioning.contexts

@Export
class GeneralLiabilityUWContextDefinition extends GenericUWRuleContextDefinition {
  public static final var PARAM_GLLINE: String = "generalLiabilityLine"
  public static final var PARAM_EXPOSURES: String = "glExposures"

  construct() {
    addSymbol(PARAM_GLLINE, GeneralLiabilityLine, \ec -> ec.Period.GLLine)
    addSymbol(PARAM_EXPOSURES, GLExposure[], \ec -> ec.Period.GLLine.Exposures)
  }

  override property get Key(): RuleContextDefinitionKey {
    return TC_GLPOLICY
  }

  override function appliesToPolicyLines(lines: typekey.PolicyLine[]): boolean {
    return lines.HasElements and lines.allMatch(\line -> line == TC_GENERALLIABILITYLINE)
  }
}