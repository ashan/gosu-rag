package gw.bizrules.provisioning.contexts

uses gw.bizrules.IRuleContext
uses gw.pc.bizrules.provisioning.RuleContext

/**
 * Used for constructing contexts in {@link gw.bizrules.ITriggeringPoint} implementations
 */
@Export
internal class IterativeContextBuilder extends ContextBuilder {
  private final var _iterableValues: Collection<Object>
  private final var _iterableName: String

  construct(contextDefinition: UWRuleContextDefinition, iterableName: String, values: Object) {
    super(contextDefinition)
    _iterableName = iterableName
    if (values.Class.Array) {
      _iterableValues = Arrays.asList(values as Object[])
    } else if (values typeis Collection) {
      _iterableValues = values
    } else {
      _iterableValues = null
      throw new IllegalArgumentException("Unknown type for iterable value container: " + values.Class.SimpleName)
    }
  }

  function create(): List<IRuleContext> {
    assert _contextDefinition.SymbolNames.containsAll(_values.Keys)
    return _iterableValues.map(\value -> new RuleContext(_contextDefinition, _values, _iterableName, value))
  }
}
