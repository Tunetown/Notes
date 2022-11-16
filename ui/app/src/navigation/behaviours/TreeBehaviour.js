/**
 * Tree Behaviour Handler for NoteTree
 * 
 * (C) Thomas Weber 2021 tom-vibrant@gmx.de
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
class TreeBehaviour {
	
	constructor(grid) {
		this.grid = grid;   // NoteTree instance
		
		this.expander = new ExpandedState(this);
		this.scroll = new ScrollState(this.grid.treeContainerId, 'tree');
	}
	
	/**
	 * If the behaviour supports history, this returns it, or false if not.
	 */
	getHistory() {
		return false;
	}
	
	/**
	 * Returns (if the behaviour supports history) if there is a way back.
	 */
	historyCanBack() {
		return false;
	}
	
	/**
	 * Called after the search text has been set.
	 */
	afterSetSearchText(searchtext, data) {
	}
	
	/**
	 * For a given document, this returns the siblings currently visible.
	 */
	getParentId(doc) {
		return doc.parent;
	}
	
	/**
	 * Returns the item order for the document, as used in this behaviour.
	 */
	getInitialItemOrder(doc) {
		return doc.order ? doc.order : 0;
	}
	
	/**
	 * Returns if doc is child of parentId.
	 */
	isChildOf(doc, parentId) {
		return doc.parent == parentId;
	}
	
	/**
	 * Called after docs have been deleted
	 */
	afterDelete(docs) {
	}
	
	/**
	 * Called after setting tree text size.
	 */
	afterSetTreeTextSize(size) {
	}
	
	/**
	 * Should save the current scroll position.
	 */
	saveScrollPosition() {
		this.scroll.savePosition();
	}
	
	/**
	 * Restore scroll position
	 */
	restoreScrollPosition() {
		this.scroll.restorePosition();
	}
	
	/**
	 * Called in the onFinish event handler of the Muuri Grid
	 */
	onLayoutFinish(items) {
		this.restoreScrollPosition();
	}
	
	/**
	 * Returns the parent ID for new items, when created from the tree.
	 */
	getNewItemParent() {
		return "";  // Root
	}
	
	/**
	 * Called when the back button of the tree has been pushed, if visible.
	 */
	backButtonPushed(event) {
	}
	
	/**
	 * Called when the home button of the tree has been pushed, if visible. 
	 */
	homeButtonPushed(event) {
	}
	
	/**
	 * Called after the back button in the app header has been pushed.
	 */
	appBackButtonPushed() {
		return false;
	}
	
	/**
	 * Called after the forward button in the app header has been pushed.
	 */
	appForwardButtonPushed() {
		return false;
	}
	
	/**
	 * Save state info to the passed (already filled) view state object
	 */
	saveState(state) {
		if (!state.tree) state.tree = {};
		state.tree.expanded = this.expander.getExpanded();
	}

	/**
	 * Recover state info from the passed state object
	 */
	restoreState(state) {
		if (state.tree) {
			this.expander.restoreTreeState(state.tree.expanded);
		}
	}
	
	/**
	 * Called after an item has been requested.
	 */
	afterRequest(id) {
	}
	
	/**
	 * Called after document saving
	 */
	afterSave(doc) {
	}
	
	/**
	 * Called when opening an editor in mobile mode, to have influence on the buttons at the bottom left.
	 * In desktop mode no buttons are there so this does not have any influence.
	 */
	initEditorNavButtons() {
		$('#homeButton2').hide();
	}
	
	/**
	 * Called before the grid is initialised
	 */
	beforeInit() {
		$('#treeBackButton').hide();
		$('#treeForwardButton').hide();
		$('#treeHomeButton').hide();
	}
	
	/**
	 * Called after the grid has been initialised
	 */
	afterInit() {
	}

	addPageToHistory(url) {
	}
	
	/**
	 * Called before filtering
	 */
	beforeFilter(noAnimations) {
		this.treeFontSize = this.grid.getTreeTextSize();
	}
	
	/**
	 * Called after filtering
	 */
	afterFilter(noAnimations) {
		this.grid.grid.grid.refreshSortData();
		this.grid.grid.grid.sort('treeSort');
	}
	
	/**
	 * Returns the Muuri sort data functions (which are only applied to the UI, not to the persistent data).
	 */
	getSortFunctions() {
		var that = this;
		return {
			treeSort: function (item, element) {
				var d = Notes.getInstance().getData();
				var data = $(element).find('.' + that.getItemContentClass()).data(); 
				var doc = d.getById(data.id);
				
				return Document.getHierarchicalSortOrderCriteria(doc);
			}
		}
	}
	
	/**
	 * Returns the callback for layouting, or an empty object if using the default Muuri layouter.
	 */
	getLayoutCallback() {
		return {};
	}
	
	/**
	 * Enable Muuri algo which compares the item areas by a scoring algorithm for dropping items
	 * by returning the score needed to be reached. If the scoring algo should be disabled at all, return -1.
	 */
	getScoreMatchingThreshold() {
		return 70;
	}
	
	/**
	 * Called after the item tree is updated.
	 */
	afterUpdateItems() {
	}
	
	/**
	 * Fills the DOM of the item content div (the inner one needed for muuri). 
	 */
	setupItemContent(itemContent, doc, additionalTextBefore, additionalTextAfter) {
		itemContent.append(
			// We use a container holding all item content inside the content div.
			$('<div class="' + this.getItemInnerContainerClass() + '">').append([
				// Icon
				$('<div class="' + this.getIconClass() + '"></div>'),
				
				// Text
				$('<div class="' + this.getItemTextClass() + '">' + additionalTextBefore + doc.name + additionalTextAfter + '</div>'),
			]).append(
				// Labels
				Document.getLabelElements(doc, 'doc-label-tree')
			),
			
			// Drag handle (dynamically blended in)
			$('<div class="' + this.getDragHandleClass() + '"></div>')
		);
	}

	/**
	 * Adjusts the sizes of the items on initialization. Takes the outer and inner elements
	 * of the Muuri grid items as parameters (jquery instances). Also, the data container of 
	 * the node is passed, containing the meta information of the item, along with the muuri item instance itself.
	 */
	setItemStyles(muuriItem, doc, itemContainer, itemContent, searchText) {
		var labels = itemContent.find('.doc-label');
		labels.css('min-width', this.treeFontSize + 'px');
		labels.css('max-width', this.treeFontSize + 'px');
		labels.css('min-height', this.treeFontSize + 'px');
		labels.css('max-height', this.treeFontSize + 'px');
		
		var data = Notes.getInstance().getData();
		var hasChildren = data.hasChildren(doc._id);
		var iconEl = itemContent.find('.' + this.getIconClass());
		iconEl.toggleClass('folder', hasChildren);
		
		var poss = this.getAllPossibleIconStyleClasses();
		for(var p in poss) iconEl.toggleClass(poss[p], false);
		iconEl.toggleClass(this.getIconStyleClass(this.isItemOpened(doc), doc), true); 
		
		// Indentation of tree children
		var indent = searchText ? 0 : (doc.level * 20);
		itemContent.css('padding-left', indent + "px");
	}
	
	getById(id) {
		return Notes.getInstance().getData().getById(id);
	}
	
	/**
	 * Returns if the doc should be shown
	 */
	isItemVisible(doc, searchText) {  
		// If a search is going on, we show all items the search is positive for
		if (searchText) {
			return Notes.getInstance().getData().containsText(doc, searchText);
		}
		
		// If the state is unclear, hide (this is the case when synchronizing for example)
		if (doc.parent && !doc.parentDoc) return false;
		
		// Always show root items
		if (!doc.parentDoc) return true;
		
		if (!this.expander.isExpanded(doc.parent)) return false;

		return this.isItemVisible(doc.parentDoc);
	}
	
	/**
	 * Returns if the document has children.
	 */
	hasChildren(doc) {
		var data = Notes.getInstance().getData();
		return data.hasChildren(doc._id);
	}
	
	/**
	 * Returns the children of the document.
	 *
	getChildren(doc) {
		return Notes.getInstance().getData().getChildren(doc ? doc._id : '');
	}
	
	/**
	 * Returns if the item is opened
	 */
	isItemOpened(doc) {
		return this.expander.isExpanded(doc._id);
	}
	
	/**
	 * Returns if the items should be colored like their ancestors if they do not have an own color.
	 */
	enableRecursiveColors() {
		return true;
	}
	
	/**
	 * Used to apply custom colors to the items. The node is a result of getNodeById(), the
	 * back flag marks if we need to set the bakcground or text color.
	 */
	colorItem(element, doc, color, back) {
		if (back) {
			Document.setItemBackground(doc, element, color ? color : 'white');
		} else {
			if (!color) return;
			$(element).css('color', color);
		}
	}
	
	/**
	 * Called after the item options have been shown
	 */
	callItemOptions(ids, x, y) {
		if (!ids.length) return;
		
		// Show drag handle
		var node = this.grid.getItemContent(ids[ids.length-1]);
		$(node).find('.' + this.getDragHandleClass()).css('display', 'block');
	}
	
	/**
	 * Called after hiding the options for all items
	 */
	afterHideOptionMenus(optionsWasVisibleBefore) {
		$('.' + this.getDragHandleClass()).each(function(i) { 
		    $(this).css("display", "none");
		});
	}
	
	/**
	 * Called after dropping, before the data is saved.
	 */
	afterDropBeforeSave(docsSrc, docTarget, moveToSubOfTarget) {
		this.grid.block();
	}
	
	/**
	 * Called after dopping, before the tree is re-requested.
	 */
	afterDrop(docSrc, docTarget, moveToSubOfTarget) {
		if (moveToSubOfTarget) {
			// If we moved into another item, we also expand it
			this.expander.expandPathTo(docTarget, true);
			//this.focus(docTarget._id);
		}

		this.grid.destroy();
		this.grid.init(true);
		
		return Promise.resolve({ ok: true }); 
	}
	
	/**
	 * Sets focus on the given document.
	 */
	focus(id, fromLinkage) {
		var doc = Notes.getInstance().getData().getById(id);
		this.expander.expandPathTo(doc ? doc.parentDoc : "");
	}
	
	supportsLinkEditorToNavigation() {
		return false;
	}
	
	supportsLinkNavigationToEditor() {
		return true;
	}
	
	/**
	 * Opens the given document in the navigation.
	 */
	open(id) {
		var doc = Notes.getInstance().getData().getById(id);
		this.expander.expandPathTo(doc);
		this.grid.setSelected(id);
	}
	
	/**
	 * Returns if the expand/collapse events should be animated
	 */
	animateOnExpandedStateChange() {
		return false;
	}
	
	/**
	 * Called after expanding a node
	 */
	beforeExpand(id, noFilter) {
	}
		
	/**
	 * Called after expanding a node
	 */
	afterExpand(id, noFilter) {
	}
	
	/**
	 * Called after expanding a node
	 */
	beforeCollapse(id, noFilter) {
	}
		
	/**
	 * Called after collapsing a node
	 */
	afterCollapse(id, noFilter) {
		
	}
	
	/**
	 * Returns if dropping src onto tar (both content jquery onjects) is allowed.
	 * dropInto denotes if the user wants to drop into or nebeath the target.
	 */
	isDropAllowed(src, tar, dropInto) {
		return !Notes.getInstance().getData().isChildOf(tar.data().id, src.data().id);
	}
	
	/**
	 * Called before the color picker is initialized. Parameters are the doc ID, 
	 * the color input element and a flag telling if it is background or text color
	 * to change.
	 */
	beforeColorPicker(id, input, back) {
		$('.' + this.getDragHandleClass()).each(function(i) { 
		    $(this).css("display", "none");
		});
	}
	
	/**
	 * Returns the icons for the file (can by glyph classes or any other).
	 * Receives the document type, returns a string containing the class(es).
	 */
	getIconStyleClass(isOpened, docIn) {
		var d = Notes.getInstance().getData();
		var doc = Document.getTargetDoc(docIn);
		
		if ((doc.type == 'note') && (doc.editor == 'board') && !isOpened) return 'fa fa-border-all'; 
		
		if (d.hasChildren(doc._id)) return isOpened ? 'fa fa-caret-down' : 'fa fa-caret-right';
		
		switch (doc.type) {
		case 'note':       return 'fa fa-file'; 
		case 'reference':  return 'fa fa-long-arrow-alt-right';   // Should not be called anymore! Refs are shown differently now.
		case 'attachment': return 'fa fa-paperclip';             
		case 'sheet':      return 'fa fa-table'; 
		}
		return '';
	}
	
	/**
	 * Returns all possible icon style classes.
	 */
	getAllPossibleIconStyleClasses() {
		return [
			'fa fa-border-all',   // TODO const! hier und die funktion davor.
			'fa fa-caret-down',
			'fa fa-caret-right',
			'fa fa-file',
			'fa fa-paperclip',
			'fa fa-long-arrow-alt-right',
			'fa fa-paperclip',
			'fa fa-table'
		]
	}
	
	/**
	 * Makes the node (content element) look unselected.
	 */
	deselectItem(node) {
		node.removeClass(this.getGridSelectedClass());
		node.parent().removeClass(this.getGridParentSelectedClass());
	}
	
	/**
	 * Makes the node (content element) look selected.
	 */
	selectItem(node, selectedId) {
		node.addClass(this.getGridSelectedClass());
		node.parent().addClass(this.getGridParentSelectedClass());
	}
	
	/**
	 * Get muuri main container item class
	 */
	getItemClass() {
		return "muuri-item";
	}
	
	/**
	 * Get muuri item content class
	 */
	getItemContentClass() {
		return "muuri-item-content";
	}

	/**
	 * Returns the class attached when the user wants to drop something into another as a child
	 */
	getMoveIntoClass() {
		return "moveInto";
	}
	
	/**
	 * Returns the class used as handle for dragging
	 */
	getDragHandleClass() {
		return 'treeDragHandle';
	}
	
	/**
	 * Get tree item text class
	 */
	getItemTextClass() {
		return "treeitemtext";
	}
	
	/**
	 * Get tree item container class, which is placed inside the content element (seen from Muuri), and holding the
	 * text (as separate div) and the tree icon.
	 */
	getItemInnerContainerClass() {
		return "treeitemcontainer";
	}
	
	/**
	 * Get tree item icon class
	 */
	getIconClass() {
		return "treeicon";
	}
	
	/**
	 * Get grid selected class
	 */
	getGridSelectedClass() {
		return "gridSelected";
	}
	
	/**
	 * Get grid parent selected class
	 */
	getGridParentSelectedClass() {
		return "gridParentSelected";
	}
	
	/**
	 * Reset instance
	 */
	reset() {
	}
	
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Register events for grid items.
	 */
	registerItemEvents(itemElement) {
		var that = this;

		// Main event: Select document. On hold (delayed): Show options and drag handle.
		itemElement.find('.' + this.getItemInnerContainerClass()).each(function(i) {
			this.mainEvent = new TouchClickHandler(this, {
				onGestureFinishCallback: function(event) {
					return that.onSelectEvent(event);
				},
				
				delayedHoldCallback: function(event) {
					var data = $(event.currentTarget).parent().data();
					that.callOptionsWithId([data.id], Tools.extractX(event), Tools.extractY(event));
				},
				delayHoldMillis: 600
			});
		});
		
		// Tree event: Attached to the icons only, without any delayed functionality
		itemElement.find('.' + this.getItemInnerContainerClass() + ' .' + this.getIconClass()).each(function(i) {
			this.mainEvent = new TouchClickHandler(this, {
				onGestureFinishCallback: function(event) {
					return that.onTreeEvent(event);
				}
			});
		});
	}
	
	/**
	 * Call options
	 */
	callOptionsWithId(ids, x, y) {
		if (!ids.length) return;
		this.grid.setSelected(ids[ids.length-1]);
		this.grid.callOptionsWithId(ids, x, y);
	}
	
	/**
	 * Handle the select event 
	 */
	onSelectEvent(event) {
		var data = $(event.currentTarget).parent().data();

		this.grid.itemClicked(event, data.id);

		this.saveScrollPosition();
		
		if (Notes.getInstance().hideOptions()) return;
		
		this.grid.setSelected(data.id);
		this.grid.openNode(data.id);
	}
	
	/**
	 * Handle the tree collapse/expand event.
	 */
	onTreeEvent(event) {
		var data = $(event.currentTarget).parent().parent().data();

		this.grid.itemClicked(event, data.id);

		this.saveScrollPosition();
		
		if (Notes.getInstance().hideOptions()) return;
		
		if (this.grid.getSearchText().length > 0) {
			this.grid.setSearchText('');
		}
				
		this.grid.setSelected(data.id);
		
		// Expand/collapse
		if (Notes.getInstance().getData().hasChildren(data.id)) {
			if (this.expander.isExpanded(data.id)) {
				this.expander.collapseById(data.id);
			} else {
				this.expander.expandById(data.id);
			}
		}
	}
	
	/**
	 * Called when the user double clicks on the tree area
	 */
	onNavigationDoubleClick() {
		// Reload navigation (dor debugging)
		TreeActions.getInstance().requestTree()
		.then(function(data) {
			Notes.getInstance().showAlert(data.message ? data.message : 'Refreshed navigation from database.', "S", data.messageThreadId);
		});
	}
}