/**
 * Tile Behaviour Handler for NoteTree
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
class TileBehaviour {
	
	constructor(grid) {
		this.grid = grid;   // NoteTree instance
		
		this.expander = new ExpandedState(this);
		this.scroll = new ScrollState(this.grid.treeContainerId, 'tiles');
	}
	
	/**
	 * Called after docs have been deleted
	 */
	afterDelete(docs) {
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
	 * Save state info to the passed (already filled) view state object
	 */
	saveState(state) {
		if (!state.tiles) state.tiles = {};
		state.tiles.expanded = this.expander.getExpanded();
	}

	/**
	 * Recover state info from the passed state object
	 */
	restoreState(state) {
		if (state.tiles) {
			this.expander.restoreTreeState(state.tiles.expanded);
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
	 * Called before the grid is initialized
	 */
	beforeInit() {
		$('#treeBackButton').hide();
	}
	
	/**
	 * Called after the grid has been initialized
	 */
	afterInit() {
	}

	/**
	 * Called before filtering
	 */
	beforeFilter(noAnimations) {
		// Get maximum visible level
		this.maxLevel = 0;
		var that = this;

		var d = Notes.getInstance().getData();

		d.each(function(doc) {
			if (that.isItemVisible(doc)) {
				if (doc.level > that.maxLevel) that.maxLevel = doc.level;
			}
		});
		
		// Remove black background and apply opacity to moving items
		$('.' + this.getItemClass()).css('background-color', 'white');
		
		this.treeFontSize = this.grid.getTreeTextSize();
	}
	
	/**
	 * Called after filtering
	 */
	afterFilter(noAnimations) {
		// Re-apply black background and reset other stuff only needed when the items are moving
		$('.' + this.getItemClass()).css('background-color', 'black');
		
		// Sorting
		this.grid.grid.grid.refreshSortData();
		this.grid.grid.grid.sort('tileSort');
	}
	
	/**
	 * Returns the Muuri sort data functions (which are only applied to the UI, not to the persistent data).
	 */
	getSortFunctions() {
		var that = this;
		return {
			tileSort: function (item, element) {
				var d = Notes.getInstance().getData();
				var data = $(element).find('.' + that.getItemContentClass()).data(); 
				var doc = d.getById(data.id);
				
				var paddedName = doc.name;
				if (paddedName.length > 5) paddedName = paddedName.substring(0, 5);
				if (paddedName.length < 5) paddedName = paddedName.padEnd(5, '_');
				
				// Least important criteria: Order as stored persistently with the document.
				var token = Tools.pad(doc.order ? doc.order : 0, 10) + paddedName;
				
				// Next most important: Is the document expanded?
				if (that.expander.isExpanded(data.id)) {
					token = "a" + token; 
				} else {
					token = "b" + token;
				}

				// Next most important: Does the document have children?
				if (d.hasChildren(data.id)) {
					token = "a" + token; 
				} else {
					token = "b" + token;
				}
			                 
				// Next most important: Timestamp (Descending). This is done only for large
				// tiles of the highest level.
				var descStamp = "00000000000000";
				if ((data.tilescale == 1) && (doc.level == that.maxLevel)) {
					descStamp = 99999999999999 - doc.timestamp;
				} 
				token = descStamp + token;
				
				// Next most important: Is the UI item shown full sized or scaled?
				if (data.tilescale == 1) {
					token = "a" + token;
				} else {
					token = "b" + token;
				}
				
				// Return composed string sort token.
				return token;
			}
		}
	}
	
	/**
	 * Returns the callback for layouting, or an empty object if using the default Muuri layouter.
	 */
	getLayoutCallback() {
		return { 
			fillGaps: true 
		}; 
	}
	
	/**
	 * Enable Muuri algo which compares the item areas by a scoring algorithm for dropping items
	 * by returning the score needed to be reached. If the scoring algo should be disabled at all, return -1.
	 */
	getScoreMatchingThreshold() {
		return -1;
	}
	
	/**
	 * Fills the DOM of the item content div (the inner one needed for muuri). 
	 */
	setupItemContent(itemContent, level, doc, additionalIconClasses, additionalText, conflictId, isFolder) {
		var that = this;
		
		var underlayClasses = isFolder ? 'fa fa-folder' : additionalIconClasses;
		
		itemContent.append(
			// We use a container holding all item content inside the content element.
			$('<div class="' + this.getItemInnerContainerClass() + '">').append([
				// Underlay
				$('<div class="' + this.getUnderlayClass() + ' ' + underlayClasses + '"></div>'),

				// Icon
				$('<div class="' + this.getIconClass() + ' ' + additionalIconClasses + '"></div>'),
				
				// Labels
				$('<div class="doc-label-tile-container"></div>').append(
					Document.getLabelElements(doc, 'doc-label-tile')
				),
				
				// Text
				$('<div class="' + this.getItemTextClass() + '">' + doc.name + additionalText + '</div>'),
			]),
			
			// Drag handle (dynamically blended in)
			$('<div class="' + this.getDragHandleClass() + '"></div>')
		);
		
		itemContent.css('padding-left', "5px");
	}
	
	/**
	 * Returns if the doc should be shown
	 */
	isItemVisible(doc, searchText) {
		// If a search is going on, we show all items the search is positive for
		if (searchText) {
			return Notes.getInstance().getData().containsText(doc, searchText);
		}
		
		// For conflicts, show them always when the document itself is shown and expanded
		// Always show root items
		if (!doc.parentDoc) return true;
		
		if (!this.expander.isExpanded(doc.parent)) return false;

		return this.isItemVisible(doc.parentDoc);
	}
	
	/**
	 * Returns if the item is opened
	 */
	isItemOpened(doc) {
		return this.expander.isExpanded(doc._id);
	}
	
	/**
	 * Adjusts the sizes of the items on initialization. Takes the outer and inner elements
	 * of the Muuri grid items as parameters (jquery instances). Also, the data container of 
	 * the node is passed, containing the meta information of the item, along with the muuri item instance itself.
	 */
	setItemStyles(muuriItem, doc, itemContainer, itemContent, isItemVisible, searchText) {
		// Margin of item containers
		// NOTE: This could also be determined by itemContainer.outerWidth(true) - itemContainer.outerWidth(), 
		//       but this is very CPU hungry so we set this fixed here.
		var marginX = 10;  
		var marginY = 10;
		
		// Get default max tile size
		if (!this.tileSize) this.tileSize = this.getTileSize();
		
		// Derive the real tile size, dependent on the levels. We just use two levels, full and half size
		var isRoot = !doc.parent;
		var isLastLevel = (doc.level == this.maxLevel);
		var isDirectParent = ((doc.level == this.maxLevel - 1) && this.expander.isExpanded(doc._id));
		
		var scale;
		if (searchText || isLastLevel || isDirectParent) {
			scale = 1;
		} else {
			scale = 0.5;
		}
		if (isRoot && !this.expander.isExpanded(doc._id) && !searchText) {
			scale = 0.5;
		}
		
		var tileSize = this.tileSize * scale;
		
		// Save this decision in item meta data
		itemContent.data('tilescale', scale);

		// Derive width/height: We only have quadratic items in this mode
		var tileWidth = tileSize - marginX
		var tileHeight = tileSize - marginY;
		
		// Container size should be the determined tile size
		itemContainer.css('width', tileWidth + 'px');
		itemContainer.css('height', tileHeight + 'px');

		// The contents are all scaled separately and adjusted by transforms
		itemContent.find('.treeicon-tile').css('transform', 'scale(' + scale + ')');
		
		// Darken all except the elements on the focus trail: All expanded nodes are fully shown, 
		// all others are dimmed in brightness. This only works when the item container has a dark background.
		if (!this.expander.isExpanded(doc._id)) {
			var brightness = this.calculateLevelDependentFactor(doc.level, 2, 0.5);
			itemContent.css('filter', 'brightness(' + brightness * 100 + '%)');
		} else {
			itemContent.css('filter', 'brightness(100%)');
		}
		
		// Shadows: The more focused, the more (higher and larger) shadows
		var shadow = this.calculateLevelDependentFactor(doc.level)
		itemContainer.css('box-shadow', '0 ' + (shadow*8) + 'px ' + (shadow*12) + 'px 0 rgba(0, 0, 0, ' + (shadow*0.5) + '), 0 ' + (shadow*12) + 'px ' + (shadow*24) + 'px 0 rgba(0, 0, 0, 0.19)');
		
		// Make the text of expanded tiles bold
		itemContent.css('font-weight', (this.expander.isExpanded(doc._id) || (scale == 1)) ? 'bold' : 'inherit'); 
		
		// Underlay size
		if (scale == 1) {
			itemContent.find('.' + this.getUnderlayClass()).css('font-size', tileSize/1.5 + 'px');
		} else {
			itemContent.find('.' + this.getUnderlayClass()).css('font-size', tileSize/1.7 + 'px');
		}
		
		var data = Notes.getInstance().getData();
		if (data.hasChildren(doc._id)) {
			itemContent.find('.' + this.getIconClass()).css('display', 'block');
		} else {
			itemContent.find('.' + this.getIconClass()).css('display', 'none');
		}
		
		// Labels
		var labels = itemContent.find('.doc-label');
		var labelSize = this.treeFontSize * scale;
		labels.css('min-width', labelSize + 'px');
		labels.css('max-width', labelSize + 'px');
		labels.css('min-height', labelSize + 'px');
		labels.css('max-height', labelSize + 'px');
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
			$(element).css('background-color', color);
			
			// Also color the underlay
			var col = Tools.lightenDarkenColor(color, 12);
			$(element).find('.' + this.getUnderlayClass()).css('color', col);
		} else {
			$(element).css('color', color);
		}
	}
	
	/**
	 * Called after the item options have been shown
	 */
	callItemOptions(ids, x, y) {
		// Kill tree event
		if (this.selectHandler) clearTimeout(this.selectHandler);
		
		// Also show drag handle
		if (!ids.length) return;
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
		if (docTarget && moveToSubOfTarget) {
			// If we moved into another item, we also expand it
			this.expander.expandPathTo(docTarget, true);
		}
		
		this.grid.destroy();
		this.grid.init(true);
		
		return Promise.resolve({ ok: true }); //Actions.getInstance().requestTree();
	}
	
	/**
	 * Sets focus on the given document.
	 */
	focus(id) {
		var doc = Notes.getInstance().getData().getById(id);
		this.expander.expandPathTo(doc.parentDoc);
	}
	
	/**
	 * Opens the given document in the navigation.
	 */
	open(id) {
		var doc = Notes.getInstance().getData().getById(id);
		this.expander.expandPathTo(doc);
	}
	
	/**
	 * Get a factor to multiply any properties with, depending on the level.
	 * The higher the relax constant, the less impact a higher level will have.
	 */
	calculateLevelDependentFactor(level, relaxConstant, minimum, maximum) {
		if (!relaxConstant) relaxConstant = 0;
		if (!minimum) minimum = 0;
		if (!maximum) maximum = 1;
		
		var ret = 1 - (1/(this.maxLevel + relaxConstant) * (this.maxLevel - level)); 
		if (ret < minimum) ret = minimum;
		if (ret > maximum) ret = maximum;
		
		return ret;
	}
	
	/**
	 * Returns if the expand/collapse events should be animated
	 */
	animateOnExpandedStateChange() {
		return true;
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
		if (!this.grid.grid) return;
		
		// Collapse all sub-nodes of the expanded node, as well as all other nodes not on the trail
		var that = this;
		Notes.getInstance().getData().each(function(doc) {
			if (id == doc._id) return;
			
			if (!Notes.getInstance().getData().isChildOf(id, doc._id)) {
				that.expander.collapseById(doc._id, true);
			}
		});
		
		if (!noFilter) this.grid.filter(!this.animateOnExpandedStateChange());
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
		return dropInto && !Notes.getInstance().getData().isChildOf(tar.data().id, src.data().id);
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
	 * Makes the node (content element) look unselected.
	 */
	deselectItem(node) {
		node.find('.' + this.getUnderlayClass()).removeClass(this.getUnderlayGridSelectedClass());
		node.removeClass(this.getGridSelectedClass());
		node.parent().removeClass(this.getGridParentSelectedClass());
	}
	
	/**
	 * Makes the node (content element) look selected.
	 */
	selectItem(node) {
		node.find('.' + this.getUnderlayClass()).addClass(this.getUnderlayGridSelectedClass());
		node.addClass(this.getGridSelectedClass());
		node.parent().addClass(this.getGridParentSelectedClass());
	}
	
	/**
	 * Returns the icons for the file (can by glyph classes or any other).
	 * Receives the document type, returns a string containing the class(es).
	 */
	getIconStyleClass(isFolder, isOpened, doc) {
		if ((doc.type == 'note') && (doc.editor == 'board') && !isOpened) return 'fa fa-border-all'; 
		
		if (isFolder) return isOpened ? 'fa fa-minus treeicon-tile-folder-open' : 'fa fa-plus treeicon-tile-folder-closed';
		
		switch (doc.type) {
		case 'note':       return 'fa fa-file'; 
		case 'reference':  return 'fa fa-long-arrow-alt-right'; 
		case 'attachment': return 'fa fa-paperclip'; 
		case 'sheet':      return 'fa fa-table'; 
		}
		return '';
	}
	
	/**
	 * Get muuri main container item class
	 */
	getItemClass() {
		return "muuri-tile-item";
	}
	
	/**
	 * Get muuri item content class
	 */
	getItemContentClass() {
		return "muuri-tile-item-content";
	}
	
	/**
	 * Returns the class attached when the user wants to drop something into another as a child
	 */
	getMoveIntoClass() {
		return "moveInto-tile";
	}
	
	/**
	 * Returns the class used as handle for dragging
	 */
	getDragHandleClass() {
		return "tileDragHandle"; 
	}
	
	/**
	 * Get tree item text class
	 */
	getItemTextClass() {
		return "treeitemtext-tile";
	}
	
	/**
	 * Get tree item container class, which is placed inside the content element (seen from Muuri), and holding the
	 * text (as separate div) and the tree icon.
	 */
	getItemInnerContainerClass() {
		return "treeitemcontainer-tile";
	}
	
	/**
	 * Get tree item icon class
	 */
	getIconClass() {
		return "treeicon-tile";
	}
	
	/**
	 * Get grid selected class
	 */
	getGridSelectedClass() {
		return "gridSelected-tile";
	}
	
	/**
	 * Get grid parent selected class
	 */
	getGridParentSelectedClass() {
		return "gridParentSelected-tile";
	}
	
	/**
	 * Get the selection class for the underlay
	 */
	getUnderlayGridSelectedClass() {
		return 'treeitemIconOverlay-tile-selected';
	}
	
	/**
	 * Get the class for the underlay
	 */
	getUnderlayClass() {
		return 'treeitemIconOverlay-tile';
	}
	
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Register events for grid items.
	 */
	registerItemEvents(itemElement) {
		var that = this;
		
		// Main event, attached to the whole item
		itemElement.find('.' + this.getItemInnerContainerClass()).each(function(i) {
			this.mainEvent = new TouchClickHandler(this, {
				onGestureFinishCallback: function(event) {
					return that.onTreeEvent(event);
				},
				
				delayedHoldCallback: function(event) {
					var data = $(event.currentTarget).parent().data();
					that.callOptionsWithId([data.id], Tools.extractX(event), Tools.extractY(event));
				},
				delayHoldMillis: 600
			});
		});
		
		// Select event, attached to the text inside the item
		itemElement.find('.' + this.getItemTextClass()).each(function(i) {
			this.selectEvent = new TouchClickHandler(this, {
				onGestureFinishCallback: function(event) {
					return that.onSelectEvent(event);
				},
				
				delayedHoldCallback: function(event) {
					var data = $(event.currentTarget).parent().parent().data();
					that.callOptionsWithId([data.id], Tools.extractX(event), Tools.extractY(event));
				},
				delayHoldMillis: 600
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
		var data = $(event.currentTarget).parent().parent().data();
		
		this.saveScrollPosition();
		
		if (Notes.getInstance().hideOptions()) return;
		this.grid.setSelected(data.id);
		
		// For large items, open the document or expand further if possible. 
		// For small items, always expand the item first.
		if (data.tilescale < 1) {
			if (this.expander.isExpanded(data.id)) {
				this.expander.collapseById(data.id);
			} else {
				this.expander.expandById(data.id);
			}
		} else {
			this.grid.openNode(data.id);
		}
	}
	
	/**
	 * Handle the tree collapse/expand event.
	 */
	onTreeEvent(event) {
		var data = $(event.currentTarget).parent().data();

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
		} else {
			if (data.tilescale < 1) {
				this.expander.expandById(data.id);
			} else {
				this.grid.openNode(data.id);
			}
		}
	}
	
	/**
	 * Reset instance
	 */
	reset() {
		this.tileSize = false;
	}
	
	///////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////

	/**
	 * Returns the base width to use internally
	 */
	getAvailableWidth() {
		return this.grid.getContainerWidth() - (Notes.getInstance().isMobile() ? 1 : 20);  // Accounts for the scroll bar. TODO make pretty for all types of scroll bars? Very hard to get right
	}
	
	/**
	 * Used internally to derive the tile size. This divides the available width until the 
	 * parts are smaller than the max. tile size.
	 */
	getTileSize() {
		var w = this.getAvailableWidth();

		var maxSize = ClientState.getInstance().getViewSettings().tileMaxSize;
		if (!maxSize) maxSize = 220;
		
		var divideBy = 1;
		while (w/divideBy > maxSize) {
			++divideBy;
		}
		
		return w/divideBy;
	}
	
	/**
	 * Custom layout function
	 *
	layoutCallback(grid, layoutId, items, width, height, callback) {
		var layout = {
			id: layoutId,
			items: items,
			slots: [],
			styles: {},
		};
		
		var t = NoteTree.getInstance();
		var x = 0;
		var y = 0;
		var maxRowH = 0;
		var gridHeight = 0;
		var lastLevel = 0;
		for (var i = 0; i < items.length; i++) {
			layout.slots.push(x, y);

			var item = items[i];
			var m = item.getMargin();
			var w = item.getWidth() + m.left + m.right;
			var h = item.getHeight() + m.top + m.bottom;
			if (h > maxRowH) maxRowH = h;

			var nextWidth = 0;
			if (i < items.length - 1) {
				var nextMargin = items[i+1].getMargin();
				nextWidth = items[i+1].getWidth() + nextMargin.left + nextMargin.right;
			}
			if ((y + h) > gridHeight) gridHeight = y + h;
			
			x += w;
			
			// Insert break after each level change
			var insertLineBreak = false;
			if (i < items.length - 1) {
				var lvl = t.getGridItemContent(items[i+1]).data().level; 
				if (lvl < lastLevel) {
					insertLineBreak = true;
				}
				lastLevel = lvl;
			}
			
			if (insertLineBreak || (x >= width - nextWidth)) {
				y += maxRowH;
				maxRowH = 0;
				x = 0;
			}
		}
		
		// Set grid size
	    layout.styles.height = gridHeight + 'px';

	    // When the layout is fully computed let's call the callback function and
		// provide the layout object as it's argument.
		return callback(layout);
	}
	*/
}
	
