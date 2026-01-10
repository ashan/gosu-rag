package gw.apd.model

uses gw.apd.util.APDStringUtil
uses gw.api.locale.DisplayKey
uses gw.api.util.LocaleUtil
uses gw.xml.XMLNode

/**
 * Agile product developer
 */
@Export
enhancement APDCoverableContentEnhancement : APDCoverable {

  property get CoverageLibraryCategoriesXMLString() : String {
    var categories = ""
    this.CoverageLibraryCategories.eachWithIndex(\cat, i -> {
      if (i > 0) categories = categories.concat(", ")
      categories = categories.concat("&quot;"+this.LinePrefix+cat.CodeIdentifier+"&quot;")
    })
    return categories
  }

  property get ConditionAndExclusionLibraryCategoriesXMLString() : String {
    var categories = ""
    this.ConditionAndExclusionLibraryCategories.eachWithIndex(\cat, i -> {
      if (i > 0) {
        categories = categories.concat(", ")
      }
      categories = categories.concat("&quot;"+this.LinePrefix+cat.CodeIdentifier+"&quot;")
    })
    return categories
  }

  property get HasConditionAndExclusionLibrary() : boolean {
    return true
  }

  function showChildDeletionConfirmationMessage() : boolean {
    // When user selects 'no' for HasChildren in the UI, the selection gets saved in the model after this method is called.
    // Therefore, the first condition is not looking for a false bit value in HasChildren field.
    return this.HasChildren && this.ChildCoverables.HasElements
  }

  function showExposureDeletionConfirmationMessage() : boolean {
    // When user selects 'no' for HasExposure in the UI, the selection gets saved in the model after this method is called.
    // Therefore, the first condition is not looking for a false bit value in HasExposure field.
    return this.HasExposure && this.Exposures.HasElements
  }

  function buildTreeForVisualization() : XMLNode {
    var tree = new XMLNode()
    tree.setAttributeValue("Name", this.Name)

    if (this typeis APDProductLine) {
      tree.ElementName = "ProductLine"
      tree.setAttributeValue("Type", DisplayKey.get("Web.APD.ProductTree.ProductLineNode"))
    } else {
      tree.ElementName = "RiskObject"
      tree.setAttributeValue("Type", DisplayKey.get("Web.APD.ProductTree.RiskObjectNode"))
    }
    this.ClauseCategoriesUsed.each(\cat ->
      tree.addChild(cat.buildTreeForVisualization(this))
    )
    this.Exposures.each(\exp ->
      tree.addChild(exp.buildTreeForVisualization())
    )
    this.Fields.each(\fld ->
      tree.addChild(fld.buildTreeForVisualization())
    )
    this.ChildCoverables.each(\cbl ->
      tree.addChild(cbl.buildTreeForVisualization())
    )
    return tree
  }

  //********************************** Config Generation *****************************************************************/

  function buildFullTree() : XMLNode {
    var tree = new XMLNode()
    tree.setAttributeValue("Name", this.Name)
    if (checkGenerationValidity(tree)) {
      tree.setAttributeValue("Valid", "true")
    } else {
      tree.setAttributeValue("Valid", "false")
    }

    if (this typeis APDProductLine) {
      tree.ElementName = "ProductLine"

      var typelistSet = this.AllTypelists.partition(\tl -> tl.Typelist)
      typelistSet.eachKeyAndValue(\tl, attributes -> {
        var typelistTree = new XMLNode(){
          :ElementName = "Typelist"
        }
        typelistTree.setAttributeValue("Name", tl)
        tree.addChild(typelistTree)
        if (checkTypelistGenerationValidity(typelistTree, tl, attributes)) {
          typelistTree.setAttributeValue("Valid", "true")
          if (attributes.first().TypelistExists and attributes.first().DoNotRegenerate) {
            typelistTree.setAttributeValue("Generate", "false")
          } else {
            typelistTree.setAttributeValue("Generate", "true")
          }
        } else {
          typelistTree.setAttributeValue("Valid", "false")
        }
      })

      this.AllClauseCategories.each(\cat -> {
        tree.addChild(cat.buildTree())
      })
    } else {
      tree.ElementName = "RiskObject"
    }

    return buildCoverableTree(tree)
  }

  private function checkTypelistGenerationValidity(cblNode : XMLNode, tl : String, attributes : List<APDAttribute>) : Boolean {
    var valid = true
    var messages = new ArrayList<String>()

    // typename must be used only once
    if (attributes.Count != 1) {
      attributes.each(\att -> {
        messages.add(DisplayKey.get("Web.APDValidation.DuplicateTypelistName", att.Label))
      })
    }

    if (messages.Count > 0) {
      valid = false
      messages.each(\msg -> {
        var errorTree = new XMLNode()
        errorTree.ElementName = "ERROR"
        errorTree.setAttributeValue("Name", msg)
        cblNode.addChild(errorTree)
      })
    }

    return valid
  }

  private function buildCoverableTree(tree : XMLNode) : XMLNode {
    this.CostDefinitions.each(\cost ->
        tree.addChild(cost.buildTree())
    )
    this.Exposures.each(\exp ->
        tree.addChild(exp.buildTree())
    )
    this.Clauses.each(\clause ->
        tree.addChild(clause.buildTree())
    )
    this.ChildCoverables.each(\cbl ->
        tree.addChild(cbl.buildTree())
    )

    // the coverable is invalid if any of its children are not valid
    if (tree.Children.hasMatch(\node -> node.getAttributeValue("Valid") == "false")) {
      tree.setAttributeValue("Valid", "false")
    }

    return tree
  }

  function buildTree() : XMLNode {
    var tree = new XMLNode()
    tree.setAttributeValue("Name", this.Name)
    if (checkGenerationValidity(tree)) {
      tree.setAttributeValue("Valid", "true")
    } else {
      tree.setAttributeValue("Valid", "false")
    }

    if (this typeis APDProductLine) {
      tree.ElementName = "ProductLine"
      tree.setAttributeValue("Type", DisplayKey.get("Web.APD.ProductTree.ProductLineNode"))
      this.AllClauseCategories.each(\cat ->
        tree.addChild(cat.buildTree())
      )
    } else {
      tree.ElementName = "RiskObject"
      tree.setAttributeValue("Type", DisplayKey.get("Web.APD.ProductTree.RiskObjectNode"))
    }
    this.CostDefinitions.each(\cost ->
      tree.addChild(cost.buildTree())
    )
    this.Exposures.each(\exp ->
      tree.addChild(exp.buildTree())
    )

    addClauseNodes(tree)

    this.ChildCoverables.each(\cbl ->
      tree.addChild(cbl.buildTree())
    )

    // the coverable is invalid if any of its children are not valid
    if (tree.Children.hasMatch(\node -> node.getAttributeValue("Valid") == "false")) {
      tree.setAttributeValue("Valid", "false")
    }

    return tree
  }

  private function addClauseNodes(tree : XMLNode) {
    //Identify and process any child clauses that are mis-configured
    var potentialMisconfiguredSubclauses = this.Clauses.where(\clause -> clause.ParentClause != null).toSet()

    AllClausesInCycle.each(\clauseInCycle -> {
      tree.addChild(clauseInCycle.buildTree())
      potentialMisconfiguredSubclauses.remove(clauseInCycle)
    })

    var parentBelongsToDifferentCoverable = \subclause : APDClause -> subclause.ParentClause != null and subclause.ParentClause.Coverable != this
    potentialMisconfiguredSubclauses
        .where(parentBelongsToDifferentCoverable)
        .each(\misalignedClause -> tree.addChild(misalignedClause.buildTree()))

    //add the properly configured clauses (Top Level) nodes to tree
    TopLevelClausesGroupByClauseType.each(\clause -> tree.addChild(clause.buildTree()))
  }

  private property get AllClausesInCycle() : APDClause[] {
    return this.Clauses.where(\clause -> clause.ClauseCycle.HasElements)
  }

  private property get TopLevelClausesGroupByClauseType() : APDClause[] {
    return (this.TopLevelCoverages as APDClause[])
        .concat(this.TopLevelConditions)
        .concat(this.TopLevelExclusions)
  }

  function checkGenerationValidity(cblNode : XMLNode) : Boolean {
    var valid = true
    var messages = new ArrayList<String>()

    if (this typeis APDProductLine) {
      if (not CodegenValidator.isValidName(this.CodeIdentifier)) {
        messages.add(DisplayKey.get("Web.APDValidation.ProductLine.InvalidName", DisplayKey.get("Web.APDNewProduct.CodeIdentifier")))
      }
      if (not CodegenValidator.isValidName(this.LinePrefix)) {
        messages.add(DisplayKey.get("Web.APDValidation.ProductLine.InvalidName", DisplayKey.get("Web.APDNewProduct.LinePrefix")))
      }
      if (this.LinePrefix != this.LinePrefix.toUpperCase()) {
        messages.add(DisplayKey.get("Web.APDValidation.ProductLine.Uppercase", DisplayKey.get("Web.APDNewProduct.LinePrefix")))
      }
    }

    // typename must be defined
    if (this.TypeName == null) {
      if (this typeis APDProductLine) {
        messages.add(DisplayKey.get("Web.APDValidation.ProductLine.MissingTypeName"))
      } else {
        messages.add(DisplayKey.get("Web.APDValidation.Coverable.MissingTypeName"))
      }
    } else if (not CodegenValidator.isValidName(this.TypeName)) {
      if (this typeis APDProductLine) {
        messages.add(DisplayKey.get("Web.APDValidation.ProductLine.InvalidName", DisplayKey.get("Web.APDNewProduct.TypeName")))
      } else {
        messages.add(DisplayKey.get("Web.APDValidation.Coverable.InvalidTypeName"))
      }
    }
    // must ensure default language exists for text that goes into display keys
    var lang = LocaleUtil.getDefaultLanguageType()
    if (this["Name_" + lang.Code] == null) {
      if (this typeis APDProductLine) {
        messages.add(DisplayKey.get("Web.APDValidation.ProductLine.MissingName"))
      } else {
        messages.add(DisplayKey.get("Web.APDValidation.Coverable.MissingName"))
      }
    }
    if (this["Description_" + lang.Code] == null) {
      if (this typeis APDProductLine) {
        messages.add(DisplayKey.get("Web.APDValidation.ProductLine.MissingDescription"))
      } else {
        messages.add(DisplayKey.get("Web.APDValidation.Coverable.MissingDescription"))
      }
    }
    if (this["MenuLabel_" + lang.Code] == null and not this.ScheduledItem) {
      // MenuLabel is not required for scheduled items
      if (this typeis APDProductLine) {
        messages.add(DisplayKey.get("Web.APDValidation.ProductLine.MissingMenuLabel"))
      } else {
        messages.add(DisplayKey.get("Web.APDValidation.Coverable.MissingMenuLabel"))
      }
    }

    if (this typeis APDProductLine) {
      if (!hasCoveragesIncludingChildren(this)) {
        var warningNode = new XMLNode()
        warningNode.ElementName = "WARNING"
        warningNode.setAttributeValue("Name", DisplayKey.get("Web.APDValidation.ProductLine.NoCoverages"))
        cblNode.addChild(warningNode)
      }
    }

    // check child and parent elements for duplicate names
    if (CodegenValidator.areDuplicates(this.TypeName, this.Parent.TypeName)) {
      messages.add(DisplayKey.get("Web.APDValidation.Coverable.UniqueEntityName"))
    }
    var duplicateFieldNames = CodegenValidator.findDuplicates(this.Fields*.Name)
    for (duplicateFieldName in duplicateFieldNames) {
      messages.add(DisplayKey.get("Web.APDValidation.Coverable.Children.UniqueFieldNames", duplicateFieldName))
    }

    // check code identifier uniqueness across the line between clause categories and clauses
    if (this typeis APDProductLine) {
      var duplicateBetweenCategoryAndClauseCodeIds = CodegenValidator.findDuplicates(this.AllClauseCategories*.CodeIdentifier.concat(this.AllClauses*.CodeIdentifier))
      for (duplicateClauseAndCategoryCodeId in duplicateBetweenCategoryAndClauseCodeIds) {
        messages.add(DisplayKey.get("Web.APDValidation.ClauseAndClauseCategory.UniqueCodes", duplicateClauseAndCategoryCodeId))
      }
    }

    // check typename uniqueness across the line between coverables and exposures
    var duplicateCoverableAndExposureNames = CodegenValidator.findDuplicates(this.ProductLine.AllRiskObjects*.TypeName.concat(this.ProductLine.AllExposures*.TypeName))
    if (this typeis APDProductLine) {
      for (duplicateCoverableAndExposureName in duplicateCoverableAndExposureNames) {
        messages.add(DisplayKey.get("Web.APDValidation.Coverable.UniqueCoverableAndExposureEntityNames", duplicateCoverableAndExposureName))
      }
    }
    duplicateCoverableAndExposureNames.each(\duplicateCoverableAndExposureName -> {
      if (duplicateCoverableAndExposureName.equalsIgnoreCase(this.TypeName)) {
        messages.add(DisplayKey.get("Web.APDValidation.Coverable.Children.UniqueCoverableAndExposureEntityNames", this.TypeName))
      }
    })

    // check risk object coverable has identifier defined on at least one field
    if (this.Subtype == typekey.APDCoverable.TC_APDCOVERABLE) {
      if ((this.Fields.Count != 0) && (!this.Fields.hasMatch(\field -> field.Identifier))) {
        messages.add(DisplayKey.get("Web.APDValidation.Coverable.MissingFieldIdentifier"))
      }
    }

    // check when RiskLocation has a location reference, there should only be one location field set as Jurisdiction
    if (this.RiskLocation == APDRiskLocationType.TC_REFLOCATION) {
      if (this.Fields.countWhere(\field -> field.IsLocationAndJurisdiction) > 1) {
        messages.add(DisplayKey.get("Web.APDValidation.Coverable.MultipleJurisdictions"))
      }
    }

    if (messages.Count > 0) {
      valid = false
      messages.each(\msg -> {
        var errorTree = new XMLNode()
        errorTree.ElementName = "ERROR"
        errorTree.setAttributeValue("Name", msg)
        cblNode.addChild(errorTree)
      })
    }

    this.Fields.each(\fld -> {
      if (not fld.checkGenerationValidity(cblNode)) {
        valid = false
      }
    })

    return valid
  }

  private function hasCoveragesIncludingChildren(node : APDCoverable) : boolean {
    if (node.Clauses.HasElements) {
      return true
    } else {
     return node.ChildCoverables.hasMatch(\cbl -> hasCoveragesIncludingChildren(cbl))
    }
  }

  /**
   * @return package name in which new lob code is created
   */
  property get LOBPackageName(): String {
    var packageName = gw.lang.ScriptParameters.getOrCreateParameter(ScriptParameters.getParameterPack("APDProductLinesGosuPackage")).VarcharValue
    return "${packageName}.${this.ProductLine.LinePrefix.toLowerCase()}"
  }


  property get LookupCblStartTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "#Start~(do not delete)-->"
  }

  property get LookupCblEndTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "#End~(do not delete)-->"
  }

  property get LookupCblSchStartTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "Schedule#Start~(do not delete)-->"
  }

  property get LookupCblSchEndTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "Schedule#End~(do not delete)-->"
  }

  property get LookupCblSchConditionStartTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "ScheduleCondition#Start~(do not delete)-->"
  }

  property get LookupCblSchConditionEndTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "ScheduleCondition#End~(do not delete)-->"
  }

  property get LookupCblSchExclusionStartTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "ScheduleExclusion#Start~(do not delete)-->"
  }

  property get LookupCblSchExclusionEndTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "ScheduleExclusion#End~(do not delete)-->"
  }

  property get LookupCovStartTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "Cov#Start~(do not delete)-->"
  }

  property get LookupCovEndTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "Cov#End~(do not delete)-->"
  }

  property get LookupSchItemCovStartTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "SchItemCov#Start~(do not delete)-->"
  }

  property get LookupSchItemCovEndTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "SchItemCov#End~(do not delete)-->"
  }

  property get LookupExclStartTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "Excl#Start~(do not delete)-->"
  }

  property get LookupExclEndTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "Excl#End~(do not delete)-->"
  }

  property get LookupSchItemExclStartTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "SchItemExcl#Start~(do not delete)-->"
  }

  property get LookupSchItemExclEndTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "SchItemExcl#End~(do not delete)-->"
  }


  property get LookupCondStartTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "Cond#Start~(do not delete)-->"
  }

  property get LookupCondEndTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "Cond#End~(do not delete)-->"
  }


  property get LookupSchItemCondStartTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "SchItemCond#Start~(do not delete)-->"
  }

  property get LookupSchItemCondEndTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "SchItemCond#End~(do not delete)-->"
  }

  property get LookupModStartTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "Mod#Start~(do not delete)-->"
  }

  property get LookupModEndTag() : String {
    return "<!--#GEN_TAG:" + this.LinePrefix + this.TypeName + "Mod#End~(do not delete)-->"
  }

  /**
   * @return relative directory of lob Gosu code
   */
  property get LOBDirectory() : String[] {
    var packageTokens = this.LOBPackageName.split("\\.")
    return packageTokens.concat({this.ProductLine.LinePrefix.toLowerCase()})
  }

  property get LocationField() : String {
    if (this.RiskLocation == APDRiskLocationType.TC_ISBUILDING) return "Building.PolicyLocation"
    if (this.RiskLocation == APDRiskLocationType.TC_ISLOCATION) return "Location"

    return this.Fields.firstWhere(\f -> f.Jurisdiction).Name
  }

  /**
   * Returns a path from this coverable to the closest available location or jurisdiction. If this coverable itself
   * has a location (i.e., if the RiskLocation is TC_ISLOCATION, TC_ISBUILDING or TC_REFLOCATION), then the path will
   * reference that location. Otherwise the path goes through the parent coverable. If the coverable is a line, then
   * the path will reference the line's BaseState property. Thus, the path could lead to either a PolicyLocation or a
   * Jurisdiction. Codegen uses the JurisdictionReferencesLocation property to distinguish between the two cases.
   */
  property get ReferenceToJurisdiction() : String {
    if (this typeis APDProductLine) return ".BaseState"
    if (this.RiskLocation == APDRiskLocationType.TC_USEPARENT) return "." + this.Parent.TypeName + this.Parent.ReferenceToJurisdiction

    return "." + this.LocationField
  }

  property get DiffDepth() : Integer {
    var depths = new ArrayList<Integer>()
    depths.add(3) // basic depth of this coverable
    depths.addAll(this.ChildCoverables*.DiffDepth.toList())
    return depths.max() + 1
  }

  function getStandardBooleanTermsUsed(t : Type<APDClause>) : Integer {
    switch (t) {
      case APDCoverage : return this.Coverages*.StandardBooleanTermsUsed.max()
      case APDExclusion : return this.Exclusions*.StandardBooleanTermsUsed.max()
      case APDCondition : return this.Conditions*.StandardBooleanTermsUsed.max()
      default : return 0
    }
  }

  function getStandardChoiceTermsUsed(t : Type<APDClause>) : Integer {
    switch (t) {
      case APDCoverage : return this.Coverages*.StandardChoiceTermsUsed.max()
      case APDExclusion : return this.Exclusions*.StandardChoiceTermsUsed.max()
      case APDCondition : return this.Conditions*.StandardChoiceTermsUsed.max()
      default : return 0
    }
  }

  function getStandardDateTermsUsed(t : Type<APDClause>) : Integer {
    switch (t) {
      case APDCoverage : return this.Coverages*.StandardDateTermsUsed.max()
      case APDExclusion : return this.Exclusions*.StandardDateTermsUsed.max()
      case APDCondition : return this.Conditions*.StandardDateTermsUsed.max()
      default : return 0
    }
  }

  function getStandardDirectTermsUsed(t : Type<APDClause>) : Integer {
    switch (t) {
      case APDCoverage : return this.Coverages*.StandardDirectTermsUsed.max()
      case APDExclusion : return this.Exclusions*.StandardDirectTermsUsed.max()
      case APDCondition : return this.Conditions*.StandardDirectTermsUsed.max()
      default : return 0
    }
  }

  function getStandardStringTermsUsed(t : Type<APDClause>) : Integer {
    switch (t) {
      case APDCoverage : return this.Coverages*.StandardStringTermsUsed.max()
      case APDExclusion : return this.Exclusions*.StandardStringTermsUsed.max()
      case APDCondition : return this.Conditions*.StandardStringTermsUsed.max()
      default : return 0
    }
  }

  property get LocalizationFields() : String[] {
    var l = new ArrayList<String>() {"Name", "Description", "MenuLabel"}
    if (this.HasChildren) l.add("ChildrenLabel")
    if (this.HasExposure) l.add("ExposureLabel")
    return l.toTypedArray()
  }

  property get LocalizationLabels() : String[] {
    var l = new ArrayList<String>() {DisplayKey.get("Web.APDProductScreen.APDProductLine.Name"),
        DisplayKey.get("Web.APDProductScreen.APDProductLine.Description"),
        DisplayKey.get("Web.APDProductScreen.APDProductLine.MenuLabel")}
    if (this.HasChildren) l.add(DisplayKey.get("Web.APDCoverable.ChildrenLabel"))
    if (this.HasExposure) l.add(DisplayKey.get("Web.APDNewProduct.ExposureLabel"))
    return l.toTypedArray()
  }

  /**
   * Returns the name of the foreign key from a scheduled item coverage back to the scheduled item itself, for code
   * generation. Throws if this coverable does not have any schedule coverages.
   */
  property get ScheduleCovItemFieldName() : String {
    if (this.Coverages.hasMatch(\coverage -> coverage.HasSchedule)) {
      return APDStringUtil.makeFieldName(this.QualifiedName, "ScheduleCovItem")
    } else {
      throw new IllegalStateException("Can only get the scheduled cov item field name for a coverable with schedule coverages")
    }
  }

  property get ScheduleCondItemFieldName() : String {
    if (this.Conditions.hasMatch(\condition -> condition.HasSchedule)) {
      return APDStringUtil.makeFieldName(this.QualifiedName, "ScheduleCondItem")
    } else {
      throw new IllegalStateException("Can only get the scheduled cond item field name for a coverable with schedule conditions")
    }
  }

  property get ScheduleExclItemFieldName() : String {
    if (this.Exclusions.hasMatch(\exclusion -> exclusion.HasSchedule)) {
      return APDStringUtil.makeFieldName(this.QualifiedName, "ScheduleExclItem")
    } else {
      throw new IllegalStateException("Can only get the scheduled excl item field name for a coverable with schedule exclusions")
    }
  }


}
