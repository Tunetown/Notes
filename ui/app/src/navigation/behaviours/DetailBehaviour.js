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
	
	constructor(grid, refMode) {
		this.grid = grid;             // NoteTree instance
		
		this.selectedParent = "";
		this.sortModes = {};
		
		this.mode = refMode ? 'ref' : 'hierarchical';
		this.rootItem = null;

		// Parameters for ref mode with their defaults
		this.enableChildren = true;
		this.enableRefs = refMode;
		this.enableParents = refMode;   // Always true, not stored in client state
		this.enableLinks = refMode;
		this.enableBacklinks = refMode;
		this.groupBy = {};
		
		this.scroll = new ScrollState(this.grid.treeContainerId, 'detail');
		
		this.sortButtonsWidth = 120;
		
		// Root doument for ref mode
		this.rootDocument = {
			_id: '',
			name: 'Notebook Home',
			type: 'root'
		};
	}
	
	/**
	 * Reset instance
	 */
	reset() {
		this.selectedParent = "";
		//this.rootItem = null;
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
		
		if (this.mode == 'ref') {
			// Back to last selected
			if (!this.lastSelectedParent) return;
			
			this.selectParent(this.lastSelectedParent);
		} else {
			// Back to parent
			if (!this.selectedParent) return;
			
			var doc = Notes.getInstance().getData().getById(this.selectedParent);
			if (!doc) return;
			
			this.selectParent(doc.parent);
		}
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
	 * Called after the back button in the app header has been pushed.
	 *
	appBackButtonPushed() {
		var e = Notes.getInstance().getCurrentEditor();
		if (e) {
			console.log(e.getCurrentId());
			this.selectParent(e.getCurrentId());
		}
	}
	
	/**
	 * Called after the forward button in the app header has been pushed.
	 *
	appForwardButtonPushed() {
		this.appBackButtonPushed();
	}
	
	/**
	 * Save state info to the passed (already filled) view state object
	 */
	saveState(state) {
		if (!state.detail) state.detail = {};
		
		state.detail.sp = this.selectedParent;
		state.detail.sortModes = this.sortModes;
		
		if (this.mode == 'ref') {
			state.detail.enableChildren = this.enableChildren ? 'on' : 'off';
			state.detail.enableRefs = this.enableRefs ? 'on' : '';
			//state.detail.enableParents = this.enableParents ? 'on' : 'off';
			state.detail.enableLinks = this.enableLinks ? 'on' : 'off';
			state.detail.enableBacklinks = this.enableBacklinks ? 'on' : 'off';
			state.detail.groupBy = this.groupBy;
		}
	}

	/**
	 * Recover state info from the passed state object
	 */
	restoreState(state) {
		if (!state.detail) return;
		
		if (state.detail.sp) {
			this.selectParent(state.detail.sp);
		}
		
		if (state.detail.sortModes) {
			this.sortModes = state.detail.sortModes;
		}
		
		if (this.mode == 'ref') {
			if (state.detail.enableChildren) {
				this.enableChildren = (state.detail.enableChildren == 'on');
			}
			
			if (state.detail.enableRefs) {
				this.enableRefs = (state.detail.enableRefs == 'on');
			}
			
			/*if (state.detail.enableParents) {
				this.enableParents = (state.detail.enableParents == 'on');
			}*/
	
			if (state.detail.enableLinks) {
				this.enableLinks = (state.detail.enableLinks == 'on');
			}
	
			if (state.detail.enableChildren) {
				this.enableBacklinks = (state.detail.enableBacklinks == 'on');
			}
			
			if (state.detail.groupBy) {
				this.groupBy = state.detail.groupBy;
			}
		} else {
			this.enableChildren = true;
			this.enableRefs = false;
			//this.enableParents = false;   // Always true, not stored in client state
			this.enableLinks = false;
			this.enableBacklinks = false;	
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
		//if (this.mode == 'ref') $('#treeBackButton').hide();
		//else 
		$('#treeBackButton').show();
		$('#treeHomeButton').show();
		
		// Search buttons
		var that = this;
		$('#' + this.grid.treeRootTopSwitchContainer)
		.on('dblclick', function(event) {
			// Prevent home navigation when changing sort modes too fast
			event.stopPropagation();  
		})
		.append(
			// Group by (ref mode only)
			(this.mode != 'ref') ? null : 
			$('<div data-toggle="tooltip" title="Group by item category" class="fa fa-layer-group treeDetailTopSwitchbutton" id="sortButtonCategory"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				
				that.setNextGroupMode();
			}),
			
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
		
		ClientState.getInstance().saveTreeState();
		
		this.saveScrollPosition();
		this.grid.filter();
	}
	
	/**
	 * Returns the groupBy mode for the currently selected parent.
	 */
	getGroupMode() {
		var ret = this.groupBy[this.selectedParent];
		if (!ret) return 'category';
		return ret;
	}
	
	/**
	 * Sets a group mode for the currently selected parent.
	 */
	setGroupMode(mode) {
		if (!(typeof this.groupBy == 'object')) {
			this.groupBy = {};
		}
		this.groupBy[this.selectedParent] = mode;

		this.updateSortButtons();
		
		ClientState.getInstance().saveTreeState();

		this.saveScrollPosition();
		this.grid.filter();
	}
	
	/**
	 * Sets the next group mode in rotation.
	 */
	setNextGroupMode() {
		if (this.getGroupMode() == 'category') this.setGroupMode('none');
		else this.setGroupMode('category');
	}
	
	/**
	 * Update the state of the sort buttons to the current sort mode and direction.
	 */
	updateSortButtons() {
		// Sort
		var s = this.getCurrentSortMode();
		
		$('#sortButtonCategory').css('color', (this.getGroupMode() == 'category') ? 'black' : 'grey');

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
		
		this.updateSortButtonsWidth();
	}
	
	/**
	 * Called after the grid has been initialized
	 */
	afterInit() {
	}

	/**
	 * Called after setting tree text size.
	 */
	afterSetTreeTextSize(size) {
		this.updateSortButtonsWidth();
	}

	/**
	 * Update the width buffer value for the sort buttons panel.
	 */
	updateSortButtonsWidth() {
		this.sortButtonsWidth = $('#' + this.grid.treeRootTopSwitchContainer).outerWidth(true) + 10;
	}

	/**
	 * Called before filtering
	 */
	beforeFilter(noAnimations) {
		this.treeFontSize = this.grid.getTreeTextSize();
		
		var settings = Settings.getInstance().settings;
		var iH = Notes.getInstance().isMobile() ? settings.detailItemHeightMobile : settings.detailItemHeightDesktop;
		this.itemHeight = iH ? iH : (this.treeFontSize * 4.4);
		
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
		this.grid.grid.grid.refreshSortData();
		
		const that = this;
		this.grid.grid.grid.sort(function (itemA, itemB) {
			// Get documents
			const dataA = $(itemA.getElement()).find('.' + that.getItemContentClass()).data();
			const docA = that.getById(dataA.id);
			const dataB = $(itemB.getElement()).find('.' + that.getItemContentClass()).data();
			const docB = that.getById(dataB.id);
				
			const docAmeta = that.getItemRefTypeDescriptor(docA);
			const docBmeta = that.getItemRefTypeDescriptor(docB);

			//console.log('==================');
			
			// Flexible sorting
			const sortWeight = that.getSortComparisonValue(docA, docB, docAmeta, docBmeta); 
			const groupWeightA = that.getSortWeight(docA, docAmeta);
			const groupWeightB = that.getSortWeight(docB, docBmeta);
			
			//console.log(docA.name + ' vs ' + docB.name + ': ' + sortWeight + '   ' + groupWeightA + '    ' + groupWeightB);
			//console.log(docAmeta);
			//console.log(docBmeta);
			
			//if (sortWeight > 1) console.log("Sort weight out of range: " + sortWeight); 
			//if (sortWeight < -1) console.log("Sort weight out of range: " + sortWeight); 
			
			return sortWeight + groupWeightA - groupWeightB;
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
	 * Get sort weight for sorting the items. Should return a numeric value in range [-1..1].
	 */
	getSortComparisonValue(docA, docB, docAmeta, docBmeta) {
		const d = Notes.getInstance().getData();
		
		// Selected parent always on top
		if (docAmeta.isSelectedParent) return -1;
		if (docBmeta.isSelectedParent) return 1;
		
		// Parent of the selected item always second (only applies to ref mode, else it is irrelevant because the parent is never shown)
		if (docAmeta.isParentOfSelectedParent) return docBmeta.isSelectedParent ? 1 : -1; 
		if (docBmeta.isParentOfSelectedParent) return docAmeta.isSelectedParent ? -1 : 1; 
		
		const s = this.getCurrentSortMode();
		
		// Sort by size (deep)
		if (s.mode == 'size') {
			const docsizeA = d.getSize(docA, true);
			const docsizeB = d.getSize(docB, true);
			return (s.up ? this.getComparisonValue(docsizeA, docsizeB) : this.getComparisonValue(docsizeB, docsizeA));
		}

		const nameAlower = (docA && docA.name) ? docA.name.toLowerCase() : '';
		const nameBlower = (docB && docB.name) ? docB.name.toLowerCase() : '';

		// Sort by name
		if (s.mode == 'name') {
			if (nameAlower == nameBlower) return 0;
			if (nameAlower > nameBlower) return (s.up ? -1 : 1);
			else return (s.up ? 1 : -1);
		}
			
		// Sort by last changed (deep)
		if (s.mode == 'lastChanged') {
			const tsA = d.getLatest(docA).timestamp;
			const tsB = d.getLatest(docB).timestamp;
			return (s.up ? this.getComparisonValue(tsA, tsB) : this.getComparisonValue(tsB, tsA));
		}
			
		// Default: Sort by order as stored on DB or name value hash if no order is existing
		const cmpValueA = Document.getRelatedOrder(docA, (this.mode == 'ref') ? this.selectedParent : false);
		const cmpValueB = Document.getRelatedOrder(docB, (this.mode == 'ref') ? this.selectedParent : false);
		//console.log(cmpValueA + '   ' + cmpValueB);
		
		return this.getComparisonValue(cmpValueA, cmpValueB);
	}
	
	/**
	 * Returns a comparison value (-1, 0 or 1).
	 */
	getComparisonValue(a, b) {
		const diff = (a - b);
		return ((diff > 0) ? 1 : ((diff == 0) ? 0 : -1));
	}
	
	/**
	 * Offset of the groups.
	 */
	static groupDistance = 100; 
	
	/**
	 * Returns a value that determines the 
	 */
	getSortWeight(doc, docmeta) {
		if (this.mode != 'ref') return 0;
		if (this.getGroupMode() != 'category') return 0;
		
		if (docmeta.isSelectedParent) return DetailBehaviour.groupDistance * 10;
		if (docmeta.isParentOfSelectedParent) return DetailBehaviour.groupDistance * 20;
		if (docmeta.isChildOfSelectedParent) return DetailBehaviour.groupDistance * 30;
		if (docmeta.isOutgoinglinkOfSelected) return DetailBehaviour.groupDistance * 40;
		if (docmeta.isBacklinkOfSelected) return DetailBehaviour.groupDistance * 50;
		if (docmeta.isReferenceToSelected) return DetailBehaviour.groupDistance * 60;
		
		return 0;
	}
	
	/**
	 * Determines meta info relevant for categorizing the document's item (most relevant in ref mode only)
	 */
	getItemRefTypeDescriptor(doc) {
		var d = Notes.getInstance().getData();
		var selectedDoc = d.getById(this.selectedParent);
		var d = Notes.getInstance().getData();
		
		// Hierarchical mode
		if (this.mode != 'ref') return {
			isSelectedParent: (doc._id == this.selectedParent),
			isParentOfSelectedParent: (selectedDoc && (doc._id == selectedDoc.parent)),
			isChildOfSelectedParent: (doc.parent == this.selectedParent),
			isBacklinkOfSelected: false, 
			isReferenceToSelected: false, 
			isOutgoinglinkOfSelected: false
		}
		
		// Reference mode
		return {
			isSelectedParent: (doc._id == this.selectedParent),
			isParentOfSelectedParent: (selectedDoc && (doc._id == selectedDoc.parent)),
			isChildOfSelectedParent: (doc.parent == this.selectedParent),
			isBacklinkOfSelected: (selectedDoc && (d.hasLinkTo(doc, selectedDoc) == 'link')),
			isReferenceToSelected: (selectedDoc && d.containsReferenceTo(doc, selectedDoc)),
			isOutgoinglinkOfSelected: (selectedDoc && (d.hasLinkTo(selectedDoc, doc) == 'link'))
		} 
	}
	
	/**
	 * Returns the Muuri sort data functions (which are only applied to the UI, not to the persistent data).
	 */
	getSortFunctions() {
		return null;
	}
	
	getById(id) {
		if ((id == '') && (this.mode == 'ref')) return this.rootDocument;
		return Notes.getInstance().getData().getById(id);
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
	 * Called after the item tree is updated.
	 */
	afterUpdateItems() {
		// Root node (only in ref mode)
		if (this.mode == 'ref') {
			if (!this.rootItem) {
				//console.log("Adding root item");
				this.rootItem = this.grid.createItem(this.rootDocument)[0];
				
				this.grid.grid.grid.add([this.rootItem], {
					index: 0,
					layout: false
				});
			}
		} else {
			if (this.rootItem) {
				//console.log("Remove root item");
				this.grid.grid.grid.remove([this.rootItem], {
					removeElements: true,
					layout: false
				});
				
				this.rootItem = null;
			}
		}
	}
	
	/**
	 * Fills the DOM of the item content div (the inner one needed for muuri). 
	 */
	setupItemContent(itemContent, doc, additionalTextBefore, additionalTextAfter) {
		// Set up item DOM
		itemContent.append(
			// Links Bar at the left
			$('<div data-toggle="tooltip" title="..." class="' + this.getItemLeftMarkerClass() + '">').append(
				$('<span class="' + this.getMarkerIconClass() + ' fa fa-chevron-right"></span>')
			),
			
			// Content
			$('<div class="' + this.getItemInnerContainerClass() + '">').append([
				// We use a container holding all item content inside the content div.
				$('<div class="' + this.getItemHeadlineClass() + '">').append([
					// Selector
					$('<div class="' + this.getSelectorClass() + '"></div>').append(
						$('<input class="' + this.getSelectorInputClass() + '" type="checkbox" data-id="' + doc._id + '" />')
					),
					
					// Icon
					$('<div class="' + this.getIconClass() + '"></div>'),
					
					// Text
					$('<div class="' + this.getItemTextClass() + '"><div class="treeitemtext-detail-text">' + additionalTextBefore + doc.name + additionalTextAfter + '</div></div>').append(
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
			
			// Links Bar at the left
			$('<div data-toggle="tooltip" title="..." class="' + this.getItemRightMarkerClass() + '">').append(
				$('<span class="' + this.getMarkerIconClass() + ' fa fa-chevron-right"></span>')
			),
			
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
		var numChildren = (this.mode == 'ref') ? this.getRefEntries(doc, true).length : d.getChildren(doc._id).length;
		
		// Get sort mode for currently selected document
		var s = this.sortModes[this.selectedParent];
		var sortMode = s ? s.mode : "";
		//var sortUp = s ? s.up : false;
		
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
	setItemStyles(muuriItem, doc, itemContainer, itemContent, searchText) {
		var data = Notes.getInstance().getData();
		var selectedDoc = data.getById(this.selectedParent);

		// Gather attributes
		var meta = this.getItemRefTypeDescriptor(doc);

		// During search, all documents are shown as normal items
		if (searchText.length > 0) meta.isSelectedParent = false;		
		
		//var isSelectedParent = (doc._id == this.selectedParent);
		var isAttachment = (doc.type == 'attachment');
		var isReference = (doc.type == 'reference');
		var hasChildren = this.hasChildren(doc);
		var isBacklinkOfSelected = this.enableBacklinks && meta.isBacklinkOfSelected; //(data.hasLinkTo(doc, selectedDoc) == 'link');
		var isParentOfSelected = this.enableParents && meta.isParentOfSelectedParent; //(selectedDoc && selectedDoc.parent && (doc._id == selectedDoc.parent));
		var isReferenceToSelected = this.enableRefs && meta.isReferenceToSelected; //(data.containsReferenceTo(doc, selectedDoc));
		var isOutgoinglinkOfSelected = this.enableLinks && meta.isOutgoinglinkOfSelected; //(data.hasLinkTo(selectedDoc, doc) == 'link');
		var isChildOfSelected = (this.selectedParent == doc.parent);
		var selectedDocName = selectedDoc ? selectedDoc.name : 'Root'; 

		var previewEl = itemContent.find('.' + this.getItemPreviewClass());
		var metaEl = itemContent.find('.' + this.getItemMetaClass());

		// Parent shall be small (like font size), the normal items should be larger.
		itemContent.css('height', meta.isSelectedParent ? '100%' : ((isParentOfSelected ? (this.treeFontSize * 1.6) : this.itemHeight) + 'px'));
		itemContainer.css('width', meta.isSelectedParent ? (this.grid.getContainerWidth() - this.sortButtonsWidth) + 'px' : '100%');
		
		// Inner container
		var innerContainer = itemContent.find('.' + this.getItemInnerContainerClass());
		innerContainer.css('margin-top', meta.isSelectedParent ? '0px' : '2px');
		innerContainer.css('margin-bottom', meta.isSelectedParent ? '0px' : '2px');

		// Category markers
		var markerLeftEl = itemContainer.find('.' + this.getItemLeftMarkerClass());
		var markerRightEl = itemContainer.find('.' + this.getItemRightMarkerClass());
		markerLeftEl.css('display', 'none');
		markerRightEl.css('display', 'none');
		
		if ((!meta.isSelectedParent) && (this.mode == 'ref')) {
			if (!isParentOfSelected) {
				// Marker at the left for backlinks and and references
				if (isBacklinkOfSelected) {
					markerLeftEl.css('display', 'block');
					markerLeftEl.css('background', '#b5f7c6');
					markerLeftEl.attr('title', 'Link from ' + doc.name + ' to ' + selectedDocName);
				}
				if (isReferenceToSelected) {
					markerLeftEl.css('display', 'block');
					markerLeftEl.css('background', '#fff2bf');
					markerLeftEl.attr('title', doc.name + ' contains a reference to ' + selectedDocName);
				}				
			}
			
			// Markers at the right for children, outgoing links of the selected doc. and parent of the selected doc.
			if (isParentOfSelected) {
				markerRightEl.css('display', 'block');
				markerRightEl.css('background', '#faacac');
				markerRightEl.attr('title', 'Parent of ' + selectedDocName + ' in the hierarchy');
			}
	 		if (isChildOfSelected) {
				markerRightEl.css('display', 'block');
				markerRightEl.css('background', '#eeeeee');
				markerRightEl.attr('title', 'Child of ' + selectedDocName + ' in the hierarchy');
			}
			if (isOutgoinglinkOfSelected) {
				markerRightEl.css('display', 'block');
				markerRightEl.css('background', '#b5f7c6');
				markerRightEl.attr('title', 'Outgoing link from ' + selectedDocName + ' to ' + doc.name);
			}
			
			// Highlight last selected
			const highlightColor = '#fada4d';
			const highlightLeft = (!isParentOfSelected) && (doc._id == this.lastSelectedParent);
			const highlightRight = highlightLeft;
			markerLeftEl.css('border', highlightLeft ? ('2px solid ' + highlightColor) : '');
			markerLeftEl.css('color', highlightLeft ? highlightColor : 'darkgrey');
			if (highlightLeft) markerLeftEl.attr('title', markerLeftEl.attr('title') + ', last opened in navigation');
			
			markerRightEl.css('border', highlightRight ? ('2px solid ' + highlightColor) : '');
			markerRightEl.css('color', highlightRight ? highlightColor : 'darkgrey');
			if (highlightRight) markerRightEl.attr('title', markerRightEl.attr('title') + ', last opened in navigation');
		}
		
		// Styling for icons (here we dont want no spaces when the icon is hidden)
		var iconEl = itemContent.find('.' + this.getIconClass());
		iconEl.css('padding-right', (hasChildren || isAttachment || isReference) ? '10px' : '0');
		iconEl.toggleClass('folder', hasChildren);
		iconEl.css('display', ((!this.enableParents) || (!meta.isSelectedParent)) ? 'block' : 'none');

		var poss = this.getAllPossibleIconStyleClasses();
		for(var p in poss) iconEl.toggleClass(poss[p], false);
		iconEl.toggleClass(this.getIconStyleClass(this.isItemOpened(doc), doc), true); 

		// Hide preview / metadata for selected parent
		previewEl.css('display', meta.isSelectedParent ? 'none' : 'block');
		metaEl.css('display', meta.isSelectedParent ? 'none' : 'block');
		
		// Set colors
		if (meta.isSelectedParent) {
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
		
		this.setItemLabelAlignment(itemContent, !meta.isSelectedParent);
		
		itemContent.find('.' + this.getSelectorClass()).css('display', this.multiSelect ? 'inline-block' : 'none');
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
		var d = Notes.getInstance().getData();
		var selectedDoc = d.getById(this.selectedParent);
		
		// If a search is going on, we show all items the search is positive for
		if (searchText) {
			return d.containsText(doc, searchText);
		}
		
		if (this.selectedParent == doc._id) return true;
		
		if (this.enableChildren || (this.mode != 'ref')) {
			// Show children of the selected document
			if (this.selectedParent == doc.parent) {
				return true;
			} 
		}
		
		if (this.mode != 'ref') return false;
		
		var selectedDoc = d.getById(this.selectedParent);
		if (!selectedDoc) return false;
		
		if (this.enableRefs) {
			// Show refs to the selected document
			if (d.containsReferenceTo(doc, selectedDoc)) {
				return true;
			} 
		}
		
		if (this.enableParents) {
			// Show parents of the selected document
			if (doc._id == selectedDoc.parent) {
				return true;
			} 
		}
		
		if (this.enableLinks) {
			// Show documents which are linked in the selected document
			if (d.hasLinkTo(selectedDoc, doc) == 'link') return true;
		}
		
		if (this.enableBacklinks) {
			// Show documents which have links to this document
			if (this.hasBackLinkTo(selectedDoc, doc._id)) return true;
		}

		return false;
	}
	
	/**
	 * Returns what is regarded as backlink here
	 */
	getBacklinks(doc) {
		return Notes.getInstance().getData().getBacklinks(doc)
	}
	
	/**
	 */
	hasBackLinkTo(doc, targetId) {
		return Notes.getInstance().getData().hasBackLinkTo(doc, targetId);
	}
	
	/**
	 * For a given document, this returns the siblings currently visible.
	 */
	getParentId(doc) {
		if (this.mode == 'ref') return this.selectedParent;
		return doc.parent;
	}
	
	/**
	 * Returns all documents which are visible in ref mode. So far, only used for statistics.
	 */
	getRefEntries(doc, ignoreParent) {
		var d = Notes.getInstance().getData();
		
		var ret = [];
		if (!doc) return ret;
		
		if (this.enableChildren) {
			var children = d.getChildren(doc ? doc._id : '');
			for(var i=0; i<children.length; ++i) {
				ret.push(children[i]);
			}
		}
		
		if (!doc) return ret;
		
		if (this.enableRefs) {
			var rs = d.getReferencesTo(doc._id);
			for(var i=0; i<rs.length; ++i) {
				if (rs[i].parent) {
					if (ignoreParent && (rs[i].parent == doc.parent)) continue;
					
					var rp = d.getById(rs[i].parent);
					ret.push(rp);
				}
			}
		}
		
		if (this.enableParents && !ignoreParent) {
			if (doc.parent) {
				var p = d.getById(doc.parent);
				if (p) {
					ret.push(p);
				}
			}
		}
		
		var refs = d.getAllReferences(doc);
		if (this.enableLinks) {
			for(var r=0; r<refs.length; ++r) {
				if (refs[r].type != 'link') continue;
				
				if (ignoreParent && (refs[r].id == doc.parent)) continue;
				
				var rdoc = d.getById(refs[r].id);
				if (rdoc) {
					ret.push(rdoc);
				}
			}
		}
		
		if (this.enableBacklinks) {
			var backlinks = this.getBacklinks(doc);
			for(var r=0; r<backlinks.length; ++r) {
				if (ignoreParent && (backlinks[r].doc._id == doc.parent)) continue;
				
				ret.push(backlinks[r].doc);
			}
		}
		
		// Remove duplicates
		var uniqueRet = ret.filter(function(a, pos) {
	    	return ret.findIndex(function(b) {
				return (b._id == a._id);
			}) == pos;
		})
		
		return uniqueRet;
	}
	
	/**
	 * Returns if the document has children.
	 */
	hasChildren(doc) {
		var d = Notes.getInstance().getData();

		if (this.enableChildren || (this.mode != 'ref')) {
			if (d.hasChildren(doc._id)) {
				return true;
			}
		}
		
		if (this.mode != 'ref') return false;
		
		if (this.enableRefs) {
			if (d.getReferencesTo(doc._id).length > 0) {
				return true;
			}
		}
		
		if (this.enableParents) {
			/*if (doc.parent) {
				var p = d.getById(doc.parent);
				if (p) {
					return true;
				}
			}*/
			return true;
		}
		
		if (this.enableLinks) {
			if (doc.links && (doc.links.length > 0)) {
				return true;
			}
		}
		
		if (this.enableBacklinks) {
			var backlinks = this.getBacklinks(doc);
			if (backlinks && (backlinks.length > 0)) {
				return true;
			}
		}
		
		return false;
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
			$(element).css('background-image', '');
			$(element).css('background-color', 'lightgrey');
			$(element).css('color', 'black');
		} else {
			if (back) {
				Document.setItemBackground(doc, element, color ? color : 'white');
			} else {
				if (!color) return;
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
		/*if (moveToSubOfTarget) {
			// If we moved into another item, we also select it
			this.selectParent(docTarget ? docTarget._id : '');
		}*/
		this.grid.filter(true);
		
		if (this.multiSelect) {
			this.toggleSelectMode();
		}
		
		return Promise.resolve({
			ok: true
		});
	}
	
	supportsLinkEditorToNavigation() {
		return true;
	}
	
	supportsLinkNavigationToEditor() {
		return true;
	}
	
	/**
	 * Sets focus on the given document.
	 */
	focus(id, fromLinkage) {
		if (this.mode == 'ref') {
			this.selectParent(id, fromLinkage);
		} else {
			var doc = Notes.getInstance().getData().getById(id);
			this.selectParent(doc ? doc.parent : "", fromLinkage);
		}
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
	selectItem(node, selectedId) {
		if (selectedId == this.selectedParent) return;
		
		node.addClass(this.getGridSelectedClass());
		node.parent().addClass(this.getGridParentSelectedClass());
	}
	
	static iconClassBoard = 'fa fa-border-all';
	static iconClassFolderClosed = 'fa fa-plus';
	static iconClassFolderOpened = 'fa fa-chevron-left';
	static iconClassAttachment = 'fa fa-paperclip';
	static iconClassReference = 'fa fa-long-arrow-alt-right';
	
	/**
	 * Returns the icons for the file (can by glyph classes or any other).
	 * Receives the document type, returns a string containing the class(es).
	 */
	getIconStyleClass(isOpened, docIn) {
		var doc = Document.getTargetDoc(docIn);
		
		if ((doc.type == 'note') && (doc.editor == 'board') && !isOpened) return DetailBehaviour.iconClassBoard; 

		if (this.mode != 'ref') {
			if (this.hasChildren(doc)) return isOpened ? DetailBehaviour.iconClassFolderOpened : DetailBehaviour.iconClassFolderClosed;			
		}
		
		if (doc.type == 'attachment') return DetailBehaviour.iconClassAttachment; 
		if (doc.type == 'reference') return DetailBehaviour.iconClassReference;   // Should not be called anymore! Refs are shown differently now.
		return '';
	}
	
	/**
	 * Returns all possible icon style classes.
	 */
	getAllPossibleIconStyleClasses() {
		return [
			DetailBehaviour.iconClassBoard, 
			DetailBehaviour.iconClassFolderOpened,
			DetailBehaviour.iconClassFolderClosed,
			DetailBehaviour.iconClassAttachment,
			DetailBehaviour.iconClassReference,
		]
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
	
	getItemLeftMarkerClass() {
		return "treeitemmarkerleft-detail";
	}
	getItemRightMarkerClass() {
		return "treeitemmarkerright-detail";
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
	
	/**
	 * Returns the class for the icons in the left and right link marker areas.
	 */
	getMarkerIconClass() {
		return "treemarkericon-detail";
	}
	
	/**
	 * Returns the elements to be added to the settings panel (optional function, does not have to exist).
	 */
	getSettingsPanelContentTableRows() {
		var that = this;
		
		if (this.mode != 'ref') return [];
		
		var d = Notes.getInstance().getData();
		var selectedDoc = d.getById(this.selectedParent);
		
		return [
			$('<tr></tr>')
			.append(
				$('<td>Children</td>'),
				$('<td></td>')
				.append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.enableChildren ? 'checked' : '') + ' />')
					.each(function(i) {
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									that.enableChildren = !!this.getChecked();
									ClientState.getInstance().saveTreeState();
									that.grid.filter();
								}
							});
						}, 0);
					}),
					
					$('<span class="treesettingsinfo-detail"></span>').html('(' + d.getChildren(selectedDoc ? selectedDoc._id : '').length + ')')
				)
			),
			/*
			$('<tr></tr>')
			.append(
				$('<td>Parents</td>'),
				$('<td></td>')
				.append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.enableParents ? 'checked' : '') + ' />')
					.each(function(i) {
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									that.enableParents = !!this.getChecked();
									ClientState.getInstance().saveTreeState();
									that.grid.filter();
								}
							});
						}, 0);
					}),
				)
			),*/
			
			$('<tr></tr>')
			.append(
				$('<td>Outgoing Links</td>'),
				$('<td></td>')
				.append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.enableLinks ? 'checked' : '') + ' />')
					.each(function(i) {
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									that.enableLinks = !!this.getChecked();
									ClientState.getInstance().saveTreeState();
									that.grid.filter();
								}
							});
						}, 0);
					}),
					
					$('<span class="treesettingsinfo-detail"></span>').html('(' + ((selectedDoc && selectedDoc.links) ? selectedDoc.links.length : 0) + ')')
				)
			),
			
			$('<tr></tr>')
			.append(
				$('<td>Backlinks</td>'),
				$('<td></td>')
				.append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.enableBacklinks ? 'checked' : '') + ' />')
					.each(function(i) {
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									that.enableBacklinks = !!this.getChecked();
									ClientState.getInstance().saveTreeState();
									that.grid.filter();
								}
							});
						}, 0);
					}),
					
					$('<span class="treesettingsinfo-detail"></span>').html('(' + (d.getBacklinks(selectedDoc).length) + ')')
				)
			),
			
			$('<tr></tr>')
			.append(
				$('<td>References</td>'),
				$('<td></td>')
				.append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.enableRefs ? 'checked' : '') + ' />')
					.each(function(i) {
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									that.enableRefs = !!this.getChecked();
									ClientState.getInstance().saveTreeState();
									that.grid.filter();
								}
							});
						}, 0);
					}),
					
					$('<span class="treesettingsinfo-detail"></span>').html('(' + (d.getReferencesTo(selectedDoc ? selectedDoc._id : null).length) + ')')
				)
			)
		];		
	}
	
	/**
	 * Returns the item order for the document, as used in this behaviour.
	 */
	getInitialItemOrder(doc) {
		return Document.getRelatedOrder(doc, (this.mode == 'ref') ? this.selectedParent : false);
	}
	
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Select a new parent
	 */
	selectParent(id, fromLinkage) {
		if (this.selectedParent == id) return;
		
		// If we go deeper in the tree, we also reset the scroll position.
		if (id) {
			var docIn = Notes.getInstance().getData().getById(id);
			var doc = Document.getTargetDoc(docIn);
			if (doc && (doc.parent == old)) {
				this.resetScrollPosition();
			}
			if (doc) id = doc._id;
		}
		
		var old = this.selectedParent;
		
		this.lastSelectedParent = this.selectedParent;
		
		this.selectedParent = id;
		this.grid.filter();
		this.grid.setSelected();
		
		this.grid.refreshColors();
		
		this.updateSortButtons();
		
		if (this.grid.getSearchText().length > 0) {
			this.grid.setSearchText('');
		}
		
		var that = this;
		setTimeout(function() {
			that.restoreScrollPosition();
		}, 400);
		
		if (!fromLinkage) {
			// Open in editor when linked
			if ((!Notes.getInstance().isMobile()) && (ClientState.getInstance().getLinkageMode('editor') == 'on')) {
				var currentId = this.grid.getCurrentlyShownId();
				if (id && (currentId != id)) {
					this.grid.openNodeByNavigation(id);
				}
			}
		}
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
		var idsUsed = [];
		for(var i in ids) {
			if (!ids[i]) continue;
			idsUsed.push(ids[i]);
		}
		if (!idsUsed.length) {
			Notes.getInstance().hideOptions();
			return;
		}
				
		if (this.multiSelect) {
			// In multi select mode we place the options at the very top of the page.
			x = - Config.CONTEXT_OPTIONS_XOFFSET;
			y = - Config.CONTEXT_OPTIONS_YOFFSET;
		}
		
		this.grid.setSelected(ids[idsUsed.length-1]);
		this.grid.callOptionsWithId(idsUsed, x, y);
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
		if (!doc) {
			if (this.mode == 'ref') {
				this.selectParent('');
				return;
			} else {
				throw new Error("Doc " + data.id + " not found");
			}
		} 
		
		if (this.selectedParent == data.id) {
			if (this.mode == 'ref') {
				this.grid.setSelected();
				this.grid.openNode(data.id) //, true);
			} else {
				this.selectParent(doc.parent);
			}
		} else {
			if (this.mode == 'ref') {
				var selectedDoc = Notes.getInstance().getData().getById(this.selectedParent);
				if (selectedDoc && selectedDoc.parent && (selectedDoc.parent == data.id)) {
					// Parent if selected: do not open, navigate back.
					this.selectParent(data.id);
					return;
				}
			}
					
			this.grid.setSelected(data.id);
			this.grid.openNode(data.id); //this.mode == 'ref');
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
		if (!doc) {
			if (this.mode == 'ref') {
				this.selectParent('');
				return;
			} else {
				throw new Error("Doc " + data.id + " not found");
			}
		} 
		
		// Select as parent in navigation
		if (this.hasChildren(doc)) {
			if (this.selectedParent == data.id) {
				// Click on parent: Close it
				this.selectParent(doc.parent);
			} else {
				// Click on item: Open it
				this.selectParent(data.id);
			}
			
		} else {
			this.grid.setSelected(data.id);
			this.grid.openNode(data.id); //, true);
		}
	}
	
	/**
	 * Called when the user double clicks on the tree area
	 */
	onNavigationDoubleClick() {
		this.selectParent("");
	}
}
	
