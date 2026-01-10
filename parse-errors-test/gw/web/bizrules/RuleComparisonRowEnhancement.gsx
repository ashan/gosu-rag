package gw.web.bizrules

uses gw.bizrules.pcf.RuleComparisonRow

enhancement RuleComparisonRowEnhancement: RuleComparisonRow {
  property get HasDifferences(): boolean {
    var values = this.Values.map(\supplier -> supplier.get())
    var first = values.first()
    if (first.Class.Array) {
      return values.hasMatch(\v -> not Arrays.equals(first as Object[], v as Object[]))
    }
    return values.hasMatch(\v -> v != first)
  }
}
