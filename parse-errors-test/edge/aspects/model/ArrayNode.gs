package edge.aspects.model

uses edge.aspects.ancestors.AncestorChain
uses java.util.Collections
uses edge.aspects.model.factory.IAspectFactory
uses edge.aspects.model.factory.INodeFactory
uses java.util.ArrayList
uses java.util.Collection

/** Model node with the array value. */
final class ArrayNode<C, T> extends ModelNode<T> {

  /** Child nodes of this array nodes. Representation of array elements. */
  private var _children : List<ModelNode<T>> as readonly Children

  public construct(ctx : C, anc : AncestorChain<ModelNode<T>>, v : Object, asp(v : ModelNode<T>) : T, eltFactory : INodeFactory<C, T>) {
    super(anc, v, asp)

    if (v == null) {
      _children = Collections.emptyList<ModelNode<T>>()
    } else if (v typeis Object[]) {
      final var arr = v
      final var elements = new ArrayList<ModelNode<T>>(arr.length)
      var idx = 0
      while (idx < arr.length) {
        elements.add(eltFactory.createNode(ctx, anc.forChild(this, idx), arr[idx]))
        idx += 1
      }
      this._children = Collections.unmodifiableList(elements)
    } else {
      final var coll = v as Collection<Object>
      final var elements = new ArrayList<ModelNode<T>>(coll.size())
      var idx = 0
      for (var elt in coll) {
        elements.add(eltFactory.createNode(ctx, anc.forChild(this, idx), elt))
        idx++
      }
      this._children = Collections.unmodifiableList(elements)
    }
  }


  /** Number of child elements in this node. */
  public property get Length() : int {
    return _children.size()
  }


  /**
   * Returns children element at the specified index.
   * @throws java.lang.IllegalArgumentException if idx is not between <code>0</code> and <code>Length-1</code> inclusive.
   */
  public function childAt(idx: int): ModelNode<T> {
    return Children.get(idx)
  }

  override internal function getChildrenInternal(): Collection<ModelNode<T>> {
    return Children
  }
}
