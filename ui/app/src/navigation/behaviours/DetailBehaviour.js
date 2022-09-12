/**
 * Detail List Behaviour Handler for NoteTree
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
class DetailBehaviour {
	
	constructor(grid) {
		this.grid = grid;             // NoteTree instance
		
		this.selectedParent = "";
		this.sortModes = {};
		
		this.scroll = new ScrollState(this.grid.treeContainerId, 'detail');
	}
	
	/**
	 * Called after docs have been deleted
	 */
	afterDelete(docs) {
		if (this.multiSelect) this.toggleSelectMode();
	}
	
	/**
	 * Should save the current scroll position.
	 */
	saveScrollPosition() {
		this.scroll.savePosition(this.selectedParent);
	}
	
	/**
	 * Restore scroll position
	 */
	restoreScrollPosition() {
		this.scroll.restorePosition(this.selectedParent);
	}

	/**
	 * Internally used to reset scroll position
	 */
	resetScrollPosition(parent) {
		if (!parent) parent = this.selectedParent;
		this.scroll.resetPosition(parent);
	}
	
	/**
	 * Called in the onFinish event handler of the Muuri Grid
	 */
	onLayoutFinish(items) {
		//this.restoreScrollPosition(); // Removed: Options opening first restored an old scroll position. leading to erratic behaviour.
	}
	
	/**
	 * Returns the parent ID for new items, when created from the tree.
	 */
	getNewItemParent() {
		return this.selectedParent;
	}
	
	/**
	 * Called when opening an editor in mobile mode, to have influence on the buttons at the bottom left.
	 * In desktop mode no buttons are there so this does not have any influence.
	 */
	initEditorNavButtons() {
		$('#homeButton2').show();
	}
	
	/**
	 * Called when the back button of the tree has been pushed, if visible.
	 */
	backButtonPushed(event) {
		if (this.grid.getSearchText()) {
			this.grid.setSearchText('');
			return;
		}
		
		if (!this.selectedParent) return;
		
		var doc = Notes.getInstance().getData().getById(this.selectedParent);
		if (!doc) return;
		
		this.selectParent(doc.parent);
	}
	
	/**
	 * Called when the home button of the tree has been pushed, if visible. 
	 */
	homeButtonPushed(event) {
		this.resetScrollPosition('all');
		
		if (this.grid.getSearchText()) {
			this.grid.setSearchText('');
			return;
		}
		
		this.selectParent();
	}
	
	/**
	 * Save state info to the passed (already filled) view state object
	 */
	saveState(state) {
		if (!state.detail) state.detail = {};
		
		state.detail.sp = this.selectedParent;
		state.detail.sortModes = this.sortModes;
	}

	/**
	 * Recover state info from the passed state object
	 */
	restoreState(state) {
		if (!state.detail) return;
		
		if (state.detail.sp) {
			this.selectParent(state.detail.sp);
		}
		
		if (state.detail.sortMode) {
			this.sortModes = state.detail.sortModes;
		}
	}
	
	/**
	 * Called after an item has been requested.
	 */
	afterRequest(id) {
		var doc = Notes.getInstance().getData().getById(id);
		if (!doc) return;
		
		this.updateItemMeta(doc);
	}
	
	/**
	 * Called after document saving
	 */
	afterSave(doc) {
		this.updateItemMeta(doc);
	}
	
	/**
	 * Called before the grid is initialized
	 */
	beforeInit() {
		$('#treeBackButton').show();
		$('#treeHomeButton').show();
		
		// Search buttons
		var that = this;
		$('#' + this.grid.treeRootTopSwitchContainer).append(
			// Last changed
			$('<div data-toggle="tooltip" title="Sort by last changed" class="fa fa-sort-numeric-down treeDetailTopSwitchbutton" id="sortButtonLastChanged"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				
				that.setNextSortMode('lastChanged');
			}),

			// Name
			$('<div data-toggle="tooltip" title="Sort by name" class="fa fa-sort-alpha-down treeDetailTopSwitchbutton" id="sortButtonName"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				
				that.setNextSortMode('name');
			}),
			
			// Size
			$('<div data-toggle="tooltip" title="Sort by size" class="fa fa-sort-amount-down treeDetailTopSwitchbutton" id="sortButtonSize"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				
				that.setNextSortMode('size');
			}),
			
			// Multiple selection on/off
			$('<div data-toggle="tooltip" title="Select multiple" class="fas fa-check-square treeDetailTopSwitchbutton" id="multiSelectButton"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				
				that.toggleSelectMode();
			}),
		);
		
		this.updateSortButtons();
	}
	
	/**
	 * Turn the multi select mode on and off (multiselect)
	 */
	toggleSelectMode() {
		this.multiSelect = !this.multiSelect;
		
		Notes.getInstance().hideOptions();
		
		if (!this.multiSelect) {
			this.deselectAll();
		} 
		
		this.saveScrollPosition();
		this.updateSortButtons();
		this.grid.filter();
	}
	
	/**
	 * Deselect all items (multiselect)
	 */
	deselectAll() {
		$('.' + this.getSelectorInputClass()).prop('checked', false);
	}
	
	/**
	 * Returns the currently selected IDs (multiselect)
	 */
	getSelectedIds() {
		var ret = [];
		
		if (!this.multiSelect) {
			return ret;
		}
		
		$('.' + this.getSelectorInputClass() + ':checkbox:checked')
		.each(function() {
			var data = $(this).data();
			if (!data) return;
			var id = data.id;
			if (!id) return;
			
			ret.push(id);
		});
		
		return ret;
	}
	
	/**
	 * Toggles selection for the given ID. Returns the new state.
	 */
	toggleSelected(id) {
		var input = $('.' + this.getSelectorInputClass() + '[data-id=' + id + ']');
		if (!input) return;
		
		var ret = input.prop('checked');
		input.prop('checked', !ret);
		return ret;
	}
	
	/**
	 * Get sort mode for current parent
	 */
	getCurrentSortMode() {
		var s = this.sortModes[this.selectedParent];
		return s ? s : {
			mode: "",
			up: false
		};
	}
	
	/**
	 * Sets the next following sort mode, depending on the one passed 
	 * (which indicates just what button has been clicked, NOT the mode to be set!)
	 */
	setNextSortMode(m) {
		var s = this.getCurrentSortMode();
		
		if(s.mode != m) {
			s.mode = m;
			s.up = false;
		} else {
			if (!s.up) {
				s.mode = m;
				s.up = true;
			} else {
				s.mode = '';
				s.up = false;
			}
		}
		
		this.sortModes[this.selectedParent] = s;
		
		this.updateSortButtons();
		
		this.saveScrollPosition();
		this.grid.filter();
	}
	
	/**
	 * Update the state of the sort buttons to the current sort mode and direction.
	 */
	updateSortButtons() {
		// Sort
		var s = this.getCurrentSortMode();
		
		$('#sortButtonSize').css('color', (s.mode == 'size') ? 'black' : 'grey');
		$('#sortButtonName').css('color', (s.mode == 'name') ? 'black' : 'grey');
		$('#sortButtonLastChanged').css('color', (s.mode == 'lastChanged') ? 'black' : 'grey');
		
		$('#sortButtonSize').toggleClass('fa-sort-amount-down', (s.mode != 'size') || !s.up);
		$('#sortButtonSize').toggleClass('fa-sort-amount-up', (s.mode == 'size') && s.up);
		
		$('#sortButtonName').toggleClass('fa-sort-alpha-down', (s.mode != 'name') || !s.up);
		$('#sortButtonName').toggleClass('fa-sort-alpha-up', (s.mode == 'name') && s.up);

		$('#sortButtonLastChanged').toggleClass('fa-sort-numeric-down', (s.mode != 'lastChanged') || !s.up);
		$('#sortButtonLastChanged').toggleClass('fa-sort-numeric-up', (s.mode == 'lastChanged') && s.up);
		
		// Multiselect
		$('#multiSelectButton').toggleClass('fas', !!this.multiSelect);
		$('#multiSelectButton').toggleClass('far', !this.multiSelect);
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
		this.treeFontSize = this.grid.getTreeTextSize();
		
		var d = Notes.getInstance().getData();
		if (!d) return;
		var selDoc = d.getById(this.selectedParent);
		if (!selDoc) this.selectedParent = ''; 
	}
	
	/**
	 * Called after filtering
	 */
	afterFilter(noAnimations) {
		// Sorting
		var that = this;
		this.grid.grid.grid.refreshSortData();
		this.grid.grid.grid.sort(function (itemA, itemB) {
			// Get documents
			var d = Notes.getInstance().getData();
			var dataA = $(itemA.getElement()).find('.' + that.getItemContentClass()).data();
			var docA = d.getById(dataA.id);
			var dataB = $(itemB.getElement()).find('.' + that.getItemContentClass()).data();
			var docB = d.getById(dataB.id);
				
			// Selected parent always on top
			if (docA._id == that.selectedParent) return -1;
			if (docB._id == that.selectedParent) return 1;
				
			var s = that.getCurrentSortMode();
			
			// Sort by size (deep)
			if (s.mode == 'size') {
				var docsizeA = d.getSize(docA, true);
				var docsizeB = d.getSize(docB, true);
				return s.up ? (docsizeA - docsizeB) : (docsizeB - docsizeA);
			}

			// Sort by name
			if (s.mode == 'name') {
				if (docA.name == docB.name) return 0;
				if (docA.name > docB.name) return s.up ? -1 : 1;
				else return s.up ? 1 : -1;
			}
				
			// Sort by last changed (deep)
			if (s.mode == 'lastChanged') {
				var tsA = d.getLatest(docA).timestamp;
				var tsB = d.getLatest(docB).timestamp;
				return s.up ? (tsA - tsB) : (tsB - tsA);
			}
				
			// Default: Sort by order as stored on DB
			if (docA.order && docB.order && (docA.order != docB.order)) {
				return docA.order - docB.order;
			}

			// If orders are identical, use the names.
			if (docA.name == docB.name) {
				return 0;
			} else {
				if (docA.name > docB.name) {
					return 1;
				} else {
					return -1;
				}
			}
		});
		
		// Align the labels to the left for the upmost item
		var cnt = 0;
		var first = this.grid.grid.grid.getItems()[cnt];
		if (first) {
			while (first && !first.isVisible()) {
				first = this.grid.grid.grid.getItems()[++cnt]; 
			}
			if (first) {
				this.setItemLabelAlignment($(first.getElement()), false);
			}
		}
	}
	
	/**
	 * Returns the Muuri sort data functions (which are only applied to the UI, not to the persistent data).
	 */
	getSortFunctions() {
		return null;
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
	 * Returns the class for the multi selector
	 */
	getSelectorClass() {
		return 'detail-behaviour-selector';
	}
	
	/**
	 * Returns the class for the multi selector
	 */
	getSelectorInputClass() {
		return 'detail-behaviour-selector-input';
	}
	
	/**
	 * Fills the DOM of the item content div (the inner one needed for muuri). 
	 */
	setupItemContent(itemContent, level, doc, additionalIconClasses, additionalText, conflictId, isFolder) {
		// Set up item DOM
		itemContent.append(
			$('<div class="' + this.getItemInnerContainerClass() + '">').append([
				// We use a container holding all item content inside the content div.
				$('<div class="' + this.getItemHeadlineClass() + '">').append([
					// Selector
					$('<div class="' + this.getSelectorClass() + '"></div>').append(
						$('<input class="' + this.getSelectorInputClass() + '" type="checkbox" data-id="' + doc._id + '" />')
					),
					
					// Icon
					$('<div class="' + this.getIconClass() + ' ' + additionalIconClasses + '"></div>'),
					
					// Text
					$('<div class="' + this.getItemTextClass() + '"><div class="treeitemtext-detail-text">' + doc.name + additionalText + '</div></div>').append(
						// Labels
						Document.getLabelElements(doc, 'doc-label-detail')
					),
				]),
				
				$('<div class="' + this.getItemMetaClass() + '"></div>').append(
					$('<div class="' + this.getItemMetaContentClass() + '"></div>')
				),
					
				$('<div class="' + this.getItemPreviewClass() + '"></div>').append(
					$('<div class="' + this.getItemPreviewContentClass() + '"></div>')
				),
			]),
			
			// Drag handle (dynamically blended in)
			$('<div class="' + this.getDragHandleClass() + '"></div>')
		);
		
		itemContent.css('padding-left', "5px");
	}
	
	/**
	 * Update preview / metadata of the item to the document
	 */
	updateItemMeta(doc, itemContent) {
		var d = Notes.getInstance().getData();
		
		// Generate meta data text
		var numChildren = d.getChildren(doc._id).length;
		
		// Get sort mode for currently selected document
		var s = this.sortModes[this.selectedParent];
		var sortMode = s ? s.mode : "";
		var sortUp = s ? s.up : false;
		
		var meta = "";
		
		// Last changed
		var timesince = "";
		timesince += Tools.getTimeSinceDisplay(d.getLatest(doc).timestamp);
		if (sortMode == 'lastChanged') {
			meta += '<b>' + timesince + '</b>';
		} else {
			meta += timesince;	
		}

		// Num of children
		meta += ((numChildren > 0) ? (', ' + numChildren + ((numChildren > 1) ? ' Entries' : ' Entry')) : '');
		
		// Document size
		var sizeErrors = [];
		var docsize = d.getSize(doc, true, sizeErrors);
		var sz = docsize ? Tools.convertFilesize(docsize) : 'Empty';
		if (sortMode == 'size') {
			meta += ', <b>' + sz + '</b>';		
		} else {
			meta += ', ' + sz;	
		}			
		if (sizeErrors.length) {
			meta += ' <b>(?)</b>';
		}
		
		// Set content
		if (!itemContent) itemContent = this.grid.getItemContent(doc._id);
		if (!itemContent) return;
		itemContent.find('.' + this.getItemMetaClass()).html(meta);
		
		var preview = (doc.preview ? doc.preview : '');
		itemContent.find('.' + this.getItemPreviewContentClass()).html(preview);
	}
	
	/**
	 * Adjusts the sizes of the items on initialization. Takes the outer and inner elements
	 * of the Muuri grid items as parameters (jquery instances). Also, the data container of 
	 * the node is passed, containing the meta information of the item, along with the muuri item instance itself.
	 */
	setItemStyles(muuriItem, doc, itemContainer, itemContent, isItemVisible, searchText) {
		var data = Notes.getInstance().getData();

		// Gather attributes
		var isSelectedParent = (doc._id == this.selectedParent);
		var isAttachment = (doc.type == 'attachment');
		var isReference = (doc.type == 'reference');
		var hasChildren = data.hasChildren(doc._id);

		var previewEl = itemContent.find('.' + this.getItemPreviewClass());
		var metaEl = itemContent.find('.' + this.getItemMetaClass());

		// Parent shall be small (like font size), the normal items should be larger.
		itemContent.css('height', isSelectedParent ? '100%' : ((this.treeFontSize * 6) + 'px'));
		itemContainer.css('width', isSelectedParent ? (this.grid.getContainerWidth() - 120) + 'px' : '100%');
		
		// Styling for icons (here we dont want no spaces when the icon is hidden)
		var iconEl = itemContent.find('.' + this.getIconClass());
		iconEl.css('min-width', hasChildren ? '20px' : '0');
		iconEl.css('padding-right', (hasChildren || isAttachment || isReference) ? '10px' : '0');

		// Hide preview / metadata for selected parent
		previewEl.css('display', isSelectedParent ? 'none' : 'block');
		metaEl.css('display', isSelectedParent ? 'none' : 'block');
		
		// Set colors
		if (isSelectedParent) {
			// Override colors for selected parent
			itemContent.css('background-color', 'lightgrey');
			itemContent.css('color', 'black');
		} else {
			// Set default colors.
			// We only need to set the default colors which are not set in 
			// the document, because colorItem() is called for all others anyway.
			if (!doc.backColor) itemContent.css('background-color', 'white');
			if (!doc.color) itemContent.css('color', 'black');
			
			// Set preview / meta font size
			previewEl.css('font-size', (this.treeFontSize * 0.7) + 'px');
			metaEl.css('font-size', (this.treeFontSize * 0.7) + 'px');
		}
		
		if (isItemVisible) {
			this.updateItemMeta(doc, itemContent);

			// Height of the preview element (must be set here because of CSS rendering bugs in iOS webkit)			
			var soll = itemContent.offset().top + itemContent.height();
			var ist = previewEl.offset().top + previewEl.height();
			var diff = ist - soll;
			if (diff > 0) {
				var previewHeight = previewEl.height() - diff; 
				previewEl.css('height', previewHeight);		
			}

			var labels = itemContent.find('.doc-label');
			labels.css('min-width', this.treeFontSize + 'px');
			labels.css('max-width', this.treeFontSize + 'px');
			labels.css('min-height', this.treeFontSize + 'px');
			labels.css('max-height', this.treeFontSize + 'px');
			
			this.setItemLabelAlignment(itemContent, !isSelectedParent);
			
			itemContent.find('.' + this.getSelectorClass()).css('display', this.multiSelect ? 'inline-block' : 'none');
		}
	}
	
	/**
	 * Adjust the labels to the left or right
	 */
	setItemLabelAlignment(itemContent, alignRight) {
		var textElement = itemContent.find('.treeitemtext-detail-text');
		textElement.css('flex', alignRight ? '1 1 auto' : 'none');
	}
	
	/**
	 * Returns if the doc should be shown
	 */
	isItemVisible(doc, searchText) {
		// If a search is going on, we show all items the search is positive for
		if (searchText) {
			return Notes.getInstance().getData().containsText(doc, searchText);
		}
		
		// Only show children of the selected parent
		if ((this.selectedParent == doc.parent) || (this.selectedParent == doc._id)) {
			return true;
		} else {
			return false;
		}
	}
	
	/**
	 * Returns if the item is opened
	 */
	isItemOpened(doc) {
		return (this.selectedParent == doc._id);
	}
	
	/**
	 * Returns if the items should be colored like their ancestors if they do not have an own color.
	 */
	enableRecursiveColors() {
		return false;
	}
	
	/**
	 * Used to apply custom colors to the items. The node is a result of getNodeById(), the
	 * back flag marks if we need to set the bakcground or text color.
	 */
	colorItem(element, doc, color, back) {
		if (doc._id == this.selectedParent) {
			$(element).css('background-color', 'lightgrey');
			$(element).css('color', 'black');
		} else {
			if (back) {
				$(element).css('background-color', color);
			} else {
				$(element).css('color', color);
			}
		}
	}
	
	/**
	 * Called after the item options have been shown
	 */
	callItemOptions(ids, x, y) {
		// Kill tree event
		if (this.selectHandler) clearTimeout(this.selectHandler);
		
		if (this.multiSelect) return;
		
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
	afterDropBeforeSave(docSrc, docTarget, moveToSubOfTarget) {
	}
	
	/**
	 * Called after dopping, before the tree is re-requested.
	 */
	afterDrop(docsSrc, docTarget, moveToSubOfTarget) {
		if (docTarget && moveToSubOfTarget) {
			// If we moved into another item, we also select it
			this.selectParent(docTarget._id);
		}
		
		if (this.multiSelect) {
			this.toggleSelectMode();
		}
		
		return Promise.resolve({
			ok: true
		});
	}
	
	/**
	 * Sets focus on the given document.
	 */
	focus(id) {
		var doc = Notes.getInstance().getData().getById(id);
		this.selectParent(doc ? doc.parent : "");
	}
	
	/**
	 * Opens the given document in the navigation.
	 */
	open(id) {
		this.selectParent(id);
	}
	
	/**
	 * Returns if dropping src onto tar (both content jquery onjects) is allowed.
	 * dropInto denotes if the user wants to drop into or nebeath the target.
	 */
	isDropAllowed(src, tar, dropInto) {
		if (!dropInto && 
			this.sortModes[this.selectedParent] && 
			this.sortModes[this.selectedParent].mode
		) return false;

		var srcId = src.data().id;
		var tarId = tar.data().id;

		if (tarId == this.selectedParent) return false;
		
		return !Notes.getInstance().getData().isChildOf(tarId, srcId);
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
		node.removeClass(this.getGridSelectedClass());
		node.parent().removeClass(this.getGridParentSelectedClass());
	}
	
	/**
	 * Makes the node (content element) look selected.
	 */
	selectItem(node) {
		node.addClass(this.getGridSelectedClass());
		node.parent().addClass(this.getGridParentSelectedClass());
	}
	
	/**
	 * Returns the icons for the file (can by glyph classes or any other).
	 * Receives the document type, returns a string containing the class(es).
	 */
	getIconStyleClass(isFolder, isOpened, doc) {
		if ((doc.type == 'note') && (doc.editor == 'board') && !isOpened) return 'fa fa-border-all'; 

		if (isFolder) return isOpened ? 'fa fa-chevron-left' : 'fa fa-plus';
		
		if (doc.type == 'attachment') return 'fa fa-paperclip'; 
		if (doc.type == 'reference') return 'fa fa-long-arrow-alt-right'; 
		return '';
	}
	
	/**
	 * Get muuri main container item class
	 */
	getItemClass() {
		return "muuri-detail-item";
	}
	
	/**
	 * Get muuri item content class
	 */
	getItemContentClass() {
		return "muuri-detail-item-content";
	}
	
	/**
	 * Returns the class attached when the user wants to drop something into another as a child
	 */
	getMoveIntoClass() {
		return "moveInto-detail";
	}
	
	/**
	 * Returns the class used as handle for dragging
	 */
	getDragHandleClass() {
		return "detailDragHandle"; 
	}
	
	/**
	 * Get tree item text class
	 */
	getItemTextClass() {
		return "treeitemtext-detail";
	}
	
	/**
	 * Get tree item container class, which is placed inside the content element (seen from Muuri), and holding the
	 * text (as separate div) and the tree icon.
	 */
	getItemInnerContainerClass() {
		return "treeitemcontainer-detail";
	}
	
	/**
	 * Get the class for the item headline
	 */
	getItemHeadlineClass() {
		return "treeitemheadline-detail";
	}
	
	/**
	 * Returns the item preview class
	 */
	getItemPreviewClass() {
		return "treeitempreview-detail";
	}
	
	/**
	 * Returns the item preview container class
	 */
	getItemPreviewContentClass() {
		return "treeitempreview-content-detail";
	}
	
	/**
	 * Returns the item metadata view panel class
	 */
	getItemMetaClass() {
		return "treeitemmeta-detail";
	}
	
	/**
	 * Returns the item metadata view panel container class
	 */
	getItemMetaContentClass() {
		return "treeitemmeta-content-detail";
	}
	
	/**
	 * Get tree item icon class
	 */
	getIconClass() {
		return "treeicon-detail";
	}
	
	/**
	 * Get grid selected class
	 */
	getGridSelectedClass() {
		return "gridSelected-detail";
	}
	
	/**
	 * Get grid parent selected class
	 */
	getGridParentSelectedClass() {
		return "gridParentSelected-detail";
	}
	
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Select a new parent
	 */
	selectParent(id) {
		if (this.selectedParent == id) return;
		
		var old = this.selectedParent;
		
		this.selectedParent = id;
		this.grid.filter();
		this.grid.setSelected();
		
		// If we go deeper in the tree, we also reset the scroll position.
		if (id) {
			var doc = Notes.getInstance().getData().getById(id);
			if (doc && (doc.parent == old)) {
				this.resetScrollPosition();
			}
		}
		
		this.grid.refreshColors();
		
		this.updateSortButtons();
		
		if (this.grid.getSearchText().length > 0) {
			this.grid.setSearchText('');
		}
		
		var that = this;
		setTimeout(function() {
			that.restoreScrollPosition();
		}, 400);
	}
	
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
		
		// Select event, attached to the headline
		itemElement.find('.' + this.getItemHeadlineClass()).each(function(i) {
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
		
		// Multiselect: Here we also need the checkboxes to toggle state correctly.
		itemElement.find('.' + this.getSelectorInputClass()).each(function(i) {
			$(this).on('click', function(e) {
				if (that.multiSelect) {
					var data = $(e.currentTarget).parent().parent().parent().parent().data();
					if (data.id) {
						that.toggleSelected(data.id);
						that.callOptionsWithId(that.getSelectedIds(), Tools.extractX(e), Tools.extractY(e));
					}
				}
			});
		});
	}
	
	/**
	 * Call options
	 */
	callOptionsWithId(ids, x, y) {
		if (!ids.length) {
			Notes.getInstance().hideOptions();
			return;
		}
		
		if (this.multiSelect) {
			// In multi select mode we place the options at the very top of the page.
			x = - Config.CONTEXT_OPTIONS_XOFFSET;
			y = - Config.CONTEXT_OPTIONS_YOFFSET;
		}
		
		this.grid.setSelected(ids[ids.length-1]);
		this.grid.callOptionsWithId(ids, x, y);
	}
	
	/**
	 * Handle the select event 
	 */
	onSelectEvent(event) {
		var data = $(event.currentTarget).parent().parent().data();
		
		this.saveScrollPosition();
		
		if (this.multiSelect) {
			this.toggleSelected(data.id);
			this.callOptionsWithId(this.getSelectedIds(), Tools.extractX(event), Tools.extractY(event));
			return;
		}
		
		if (Notes.getInstance().hideOptions()) return;

		var doc = Notes.getInstance().getData().getById(data.id);
		if (!doc) throw new Error("Doc " + data.id + " not found");
		
		if (this.selectedParent == data.id) {
			this.selectParent(doc.parent);
		} else {
			this.grid.setSelected(data.id);
			this.grid.openNode(data.id);
		}
	}
	
	/**
	 * Handle the tree select event.
	 */
	onTreeEvent(event) {
		var data = $(event.currentTarget).parent().data();
		this.saveScrollPosition();
		
		if (this.multiSelect) {
			this.toggleSelected(data.id);
			this.callOptionsWithId(this.getSelectedIds(), Tools.extractX(event), Tools.extractY(event));
			return;
		}

		if (Notes.getInstance().hideOptions()) return;

		var doc = Notes.getInstance().getData().getById(data.id);
		if (!doc) throw new Error("Doc " + data.id + " not found");
		
		// Select
		if (Notes.getInstance().getData().hasChildren(data.id)) {
			if (this.selectedParent == data.id) {
				// Click on parent: Close it
				this.selectParent(doc.parent);
			} else {
				// Click on item: Open it
				this.selectParent(data.id);
			}
			
		} else {
			this.grid.setSelected(data.id);
			this.grid.openNode(data.id);
		}
	}
	
	/**
	 * Called when the user double clicks on the tree area
	 */
	onNavigationDoubleClick() {
		this.selectParent("");
	}
	
	/**
	 * Reset instance
	 */
	reset() {
	}
}
	
