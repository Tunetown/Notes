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
	
	#app = null;
	
	constructor(app, grid, refMode) {
		this.#app = app;
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
		this.enableSiblings = false; 
		this.groupBy = {};
		
		this.showGroupSeparators = true;
		
		this.scroll = new ScrollState(this.#app, this.grid.treeContainerId, 'detail');
		
		this.sortButtonsWidth = 120;
		
		// Root doument for ref mode (this is not part of the Data instance, so it is
		// kept here)
		this.rootDocument = {
			_id: '',
			name: Config.ROOT_NAME,
			type: 'root'
		};
		
		// Navigation history
		this.history = new HistoryHandler();
	}
	
	/**
	 * If the behaviour supports history, this returns it, or false if not.
	 */
	getHistory() {
		return this.history;
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
		this.#app.back();  
	}
	
	/**
	 * Called when the back button of the tree has been pushed, if visible.
	 */
	forwardButtonPushed(event) {
		this.#app.forward();  // TODO also put to the other behaviours!
	}
	
	/**
	 * Called when the home button of the tree has been pushed, if visible. 
	 */
	homeButtonPushed(event) {	
		const sy = this.scroll.getPosition().scrollY;	
		
		this.resetScrollPosition('all');
				
		if (this.grid.getSearchText()) {
			this.grid.setSearchText('');
			return;
		}
		
		if (sy > 0) return;
		
		this.selectParentFromEvent();
	}
	
	/**
	 * Returns (if the behaviour supports history) if there is a way back.
	 */
	historyCanBack() {
		return this.history.canBack() || (this.selectedParent != '');
	}
	
	/**
	 * Called after the back button in the app header has been pushed.
	 */
	appBackButtonPushed() {
		if (this.#app.device.isLayoutMobile()) return;
		
		if (this.history.canBack()) {
			var h = this.history.back();
			if (h.type == 'sel') {
				this.grid.setSearchText('', true);
				this.selectParentFromEvent(h.id, null, true);
			}
			if (h.type == 'token') {
				this.grid.setSearchText(h.token, true);
			}
			/*if (h.type == 'page') {
				this.#app.state.setLastOpenedUrl();
				location.href = h.url;
			}*/
		} else {
			this.grid.setSearchText('', true);
			this.selectParentFromEvent('', null, true);
		}
	}
	
	/**
	 * Called after the forward button in the app header has been pushed.
	 */
	appForwardButtonPushed() {
		if (this.#app.device.isLayoutMobile()) return;
		
		if (this.history.canForward()) {
			var h = this.history.forward();
			if (h.type == 'sel') {
				this.selectParentFromEvent(h.id, null, true);
			}
			if (h.type == 'token') {
				this.grid.setSearchText(h.token, true);
			}
			/*if (h.type == 'page') {
				location.href = h.url;
			}*/
		} 
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
			state.detail.enableSiblings = this.enableSiblings ? 'on' : 'off';
			state.detail.groupBy = this.groupBy;
		}
	}

	/**
	 * Removes the focus ID from state, so nothing will be restored later.
	 */
	resetFocus(state) {
		if (state.detail && state.detail.sp) delete state.detail.sp;
		this.selectedParent = '';
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
	
			if (state.detail.enableBacklinks) {
				this.enableBacklinks = (state.detail.enableBacklinks == 'on');
			}
			
			if (state.detail.enableSiblings) {
				this.enableSiblings = (state.detail.enableSiblings == 'on');
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
			this.enableSiblings = false;	
		}
	}
	
	/**
	 * Called after an item has been requested.
	 */
	afterRequest(id) {
		var doc = this.#app.data.getById(id);
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
		$('#treeForwardButton').show();
		
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
	
	addParentToHistory(id) {
		var last = this.history.get();
		if (last && (last.type == 'sel') && (last.id == id)) return;

		this.history.add({
			type: 'sel',
			id: id
		});
	}
	
	addSearchToHistory(token) {
		var last = this.history.get();
		if (last && (last.type == 'token')) return;   // TODO check prefixing instead
		
		this.history.add({
			type: 'token',
			token: token
		});
	}

	/*addPageToHistory(url) {
		var last = this.history.get();
		if (last && (last.type == 'page') && (last.url == url)) return;
		
		this.history.add({
			type: 'page',
			url: url
		});
	}*/

	/**
	 * Called after the search text has been set.
	 */
	afterSetSearchText(searchtext, data) {
		if (!data && !!searchtext) this.addSearchToHistory(searchtext);
		this.updateSortButtons();
	}
	
	/**
	 * Turn the multi select mode on and off (multiselect)
	 */
	toggleSelectMode() {
		this.multiSelect = !this.multiSelect;
		
		this.#app.hideOptions();
		
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
		
		var that = this;
		$('.' + this.getSelectorInputClass() + ':checkbox:checked')
		.each(function() {
			var data = $(this).data();
			if (!data) return;
			var id = data.id;
			if (!id) return;
			if (id == that.selectedParent) return;
			
			var selectedDoc = that.#app.data.getById(that.selectedParent);
			if (selectedDoc && (id == selectedDoc.parent)) return;
			
			ret.push(id);
		});
		
		return ret;
	}
	
	/**
	 * Toggles selection for the given ID. Returns the new state.
	 */
	toggleSelected(id) {
		if (!id) return;
		
		var input = $('.' + this.getSelectorInputClass() + '[data-id=' + id + ']');
		if (!input) return;
		
		var ret = input.prop('checked');
		input.prop('checked', !ret);
		
		this.updateSelectAllState();
		
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
		
		this.#app.state.saveTreeState();
		
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
		
		this.#app.state.saveTreeState();

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
	
	getSelectedItemHeight() {
		return this.treeFontSize * 2;
	}
	
	/**
	 * Update the state of the sort buttons to the current sort mode and direction.
	 */
	updateSortButtons() {
		if (this.grid.getSearchText().length > 0) {
			$('#' + this.grid.treeRootTopSwitchContainer).css('display', 'none');
			this.updateSortButtonsWidth();
			return;
		}
		
		const selectedHeight = this.getSelectedItemHeight();
		
		$('#' + this.grid.treeRootTopSwitchContainer)
		.css('display', 'block')
		.css('height', selectedHeight + 'px');
		
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
		this.containerWidthBuffer = this.grid.getContainerWidth();
		
		$('#' + this.grid.treeRootTopSwitchContainer)
		.css('height', this.getSelectedItemHeight() + 'px');
		
		this.itemHeight = this.#app.settings.getNavigationItemHeight();

		var d = this.#app.data;
		if (!d) return;
		var selDoc = d.getById(this.selectedParent);
		if (!selDoc) this.selectedParent = ''; 
	}
	
	/**
	 * Compare function to be used for sorting
	 */
	compareDocuments(docA, docB) {
		var that = this.#app.nav.behaviour;
		if (!that) return 0;
		
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
	}
	
	/**
	 * Called after filtering
	 */
	afterFilter(noAnimations) {
		// Sorting
		this.grid.grid.grid.refreshSortData();
		
		var selectedDoc = this.getById(this.selectedParent);
		if (selectedDoc && this.hasChildren(selectedDoc, true)) {
			$('#treeteasertext').css('display', 'none');
		} else {
			$('#treeteasertext').css('display', 'block');
			$('#treeteasertext').html((selectedDoc ? selectedDoc.name : 'This notebook') + ' has no related items to show');
		}
		
		const that = this;
		this.grid.grid.grid.sort(function(itemA, itemB) {
			// Get documents
			const dataA = $(itemA.getElement()).find('.' + that.getItemContentClass()).data();
			const docA = that.getById(dataA.id);
			const dataB = $(itemB.getElement()).find('.' + that.getItemContentClass()).data();
			const docB = that.getById(dataB.id);
				
			return that.compareDocuments(docA, docB);
		});
		
		// Align the labels to the left for the selected parent item which is always first after sorting
		var cnt = 0;
		const items = this.grid.grid.grid.getItems();
		var first = items[cnt];
		if (first) {
			while (first && !first.isVisible()) {
				first = items[++cnt]; 
			}
			if (first) {
				this.setItemLabelAlignment($(first.getElement()), false);
			}
		}
		
		// Show/hide group markers if enabled.
		if ((this.mode == 'ref') && (this.showGroupSeparators) && (this.getGroupMode() == 'category')) {
			var currentGroup = 0;
			for(var i in items) {
				if (!items[i].isVisible()) continue;
				
				const itemEl = $(items[i].getElement());
				const itemContainerEl = itemEl.find('.' + this.getItemContentClass());
				const data = itemContainerEl.data();
				if (!data) continue;
				
				const doc = this.getById(data.id);
				if (!doc) continue;
				
				var groupWeight = this.getSortWeight(doc);
				const groupMarkerEl = $(items[i].getElement()).find('.treeitem-detail-group-marker');
				
				var showMarker = false;
				if (groupWeight != currentGroup) {
					currentGroup = groupWeight;
					
					showMarker = (i > 1) && (groupWeight > DetailBehaviour.groupMarkerMinDistance);
				} 
				groupMarkerEl.css('display', showMarker ? 'block' : 'none');
				
				if (showMarker) {
					groupMarkerEl.css('width', (itemEl.width()) + 'px');
				}
			}
		}
		
		// Select last opened
		if (that.lastSelectedParent && 
		    (that.lastSelectedParent != selectedDoc.parent) && 
		    this.#app.state.getViewSettings().detailHighlightLastSelected) {
				
			that.grid.setSelected(that.lastSelectedParent);				
		}

		// Restore scroll position			
		setTimeout(function() {
			that.restoreScrollPosition();
		}, 0);
	}
	
	/**
	 * Get sort weight for sorting the items. Should return a numeric value in range [-1..1].
	 */
	getSortComparisonValue(docA, docB, docAmeta, docBmeta) {
		const d = this.#app.data;
		
		// Parent of the selected item always first (only applies to ref mode, else it is irrelevant because the parent is never shown)
		if (docAmeta.isParentOfSelectedParent) return -1;
		if (docBmeta.isParentOfSelectedParent) return 1; 
		
		// Selected item always second 
		if (docAmeta.isSelectedParent) return docBmeta.isParentOfSelectedParent ? 1 : -1; 
		if (docBmeta.isSelectedParent) return docAmeta.isParentOfSelectedParent ? -1 : 1; 

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
	static groupDistance = 100;                                             // #IGNORE static 
	static groupMarkerMinDistance = DetailBehaviour.groupDistance * 20;     // #IGNORE static 
	
	/**
	 * Returns a value that determines the 
	 */
	getSortWeight(doc, docmeta) {
		if (this.mode != 'ref') return 0;
		if (this.getGroupMode() != 'category') return 0;
		
		if (!docmeta) docmeta = this.getItemRefTypeDescriptor(doc);
		
		if (docmeta.isParentOfSelectedParent) return DetailBehaviour.groupDistance * 10;
		if (docmeta.isSelectedParent) return DetailBehaviour.groupDistance * 20;
		if (docmeta.isChildOfSelectedParent) return DetailBehaviour.groupDistance * 30;
		if (docmeta.isOutgoinglinkOfSelected) return DetailBehaviour.groupDistance * 40;
		if (docmeta.isBacklinkOfSelected) return DetailBehaviour.groupDistance * 50;
		if (docmeta.isReferenceToSelected) return DetailBehaviour.groupDistance * 60;
		if (docmeta.isSiblingOfSelected) return DetailBehaviour.groupDistance * 70;
		
		return 0;
	}
	
	/**
	 * Determines meta info relevant for categorizing the document's item (most relevant in ref mode only)
	 */
	getItemRefTypeDescriptor(doc) {
		var d = this.#app.data;
		var selectedDoc = d.getById(this.selectedParent);
		
		// Hierarchical mode
		if (this.mode != 'ref') return {
			isSelectedParent: (doc._id == this.selectedParent),
			isParentOfSelectedParent: (selectedDoc && (doc._id == selectedDoc.parent)),
			isChildOfSelectedParent: (doc.parent == this.selectedParent),
			isBacklinkOfSelected: false, 
			isReferenceToSelected: false, 
			isOutgoinglinkOfSelected: false,
			isSiblingOfSelected: false
		}
		
		// Reference mode
		return {
			isSelectedParent: (doc._id == this.selectedParent),
			isParentOfSelectedParent: (selectedDoc && (doc._id == selectedDoc.parent)),
			isChildOfSelectedParent: (doc.parent == this.selectedParent),
			isBacklinkOfSelected: (selectedDoc && (d.hasLinkTo(doc, selectedDoc) == 'link')),
			isReferenceToSelected: (selectedDoc && d.containsReferenceTo(doc, selectedDoc)),
			isOutgoinglinkOfSelected: (selectedDoc && (d.hasLinkTo(selectedDoc, doc) == 'link')),
			isSiblingOfSelected: (selectedDoc && (doc.parent == selectedDoc.parent))
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
		return this.#app.data.getById(id);
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
				$(this.rootItem).css('display', 'none');
				
				var gitm = this.grid.grid.grid.add([this.rootItem], {
					index: 0,
					layout: false
				})[0];
				
				return [gitm];
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
		
		return [];
	}
	
	/**
	 * Fills the DOM of the item content div (the inner one needed for muuri). 
	 */
	setupItemContent(itemContent, doc, additionalTextBefore, additionalTextAfter) {
		// Set up item DOM
		itemContent.append(
			$('<div class="treeitem-detail-group-marker">'),

			// Marker Bar at the left
			$('<div data-toggle="tooltip" title="..." class="' + this.getItemLeftMarkerClass() + '">').append(
				$('<span class="' + this.getMarkerIconClass() + ' fa fa-chevron-right"></span>')
			),
			
			// Content
			$('<div class="' + this.getItemInnerContainerClass() + ' ' + this.getDragHandleMarkerClass() + '">').append([
				// We use a container holding all item content inside the content div.
				$('<div class="' + this.getItemHeadlineClass() + '">').append([
					// Selector for multi selection
					$('<div class="' + this.getSelectorClass() + '"></div>').append(
						$('<input class="' + this.getSelectorInputClass() + '" type="checkbox" data-id="' + doc._id + '" />')
					),
					
					//$('<div class="' + this.getDragHandleMobileClass() + ' fa fa-bars"></div>'),
					
					// Icon
					$('<div class="' + this.getIconClass() + '"></div>'), 
					
					// Text
					$('<div class="' + this.getItemTextClass() + '"></div>').append(
						// Text
						$('<div class="treeitemtext-detail-text">' + additionalTextBefore + doc.name + additionalTextAfter + '</div>'),

						// Star label						
						$('<div class="doc-label doc-label-detail-star fa fa-star"></div>'),
						
						// Hashtags
						Document.getTagElements(doc, 'doc-hashtag-detail')
					),
				]),
				
				$('<div class="' + this.getItemMetaClass() + '"></div>').append(
					$('<div class="' + this.getItemMetaContentClass() + '"></div>')
				),
					
				$('<div class="' + this.getItemPreviewClass() + '"></div>').append(
					$('<div class="' + this.getItemPreviewContentClass() + '"></div>')
				),
			]),
			
			// Marker Bar at the right
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
		var d = this.#app.data;
		
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
		const data = this.#app.data;
		
		const selectedDoc = data.getById(this.selectedParent);
		const parentDoc = (selectedDoc && selectedDoc.parent) ? data.getById(selectedDoc.parent) : null;

		// Gather attributes
		const meta = this.getItemRefTypeDescriptor(doc);

		// During search, all documents are shown as normal items
		if (searchText.length > 0) {
			meta.isSelectedParent = false;
			meta.isParentOfSelectedParent = false;
		}		
		
		// Properties
		//const isAttachment = (doc.type == 'attachment');
		//const isReference = (doc.type == 'reference');
		const hasChildren = this.hasChildren(doc);
		const isBacklinkOfSelected = this.enableBacklinks && meta.isBacklinkOfSelected; 
		const isParentOfSelected = this.enableParents && meta.isParentOfSelectedParent; 
		const isReferenceToSelected = this.enableRefs && meta.isReferenceToSelected; 
		const isOutgoinglinkOfSelected = this.enableLinks && meta.isOutgoinglinkOfSelected;
		const isSiblingOfSelected = this.enableSiblings && meta.isSiblingOfSelected;
		const isChildOfSelected = (this.selectedParent == doc.parent);
		const selectedDocName = selectedDoc ? selectedDoc.name : 'Root';   // TODO const
		const isRoot = !selectedDoc; 

		// Elements
		const previewEl = itemContent.find('.' + this.getItemPreviewClass());
		const metaEl = itemContent.find('.' + this.getItemMetaClass());
		const groupMarker = itemContainer.find('.treeitem-detail-group-marker');
		const innerContainer = itemContent.find('.' + this.getItemInnerContainerClass());
		const itemHeader = itemContainer.find('.' + this.getItemTextClass());
		const iconClass = this.getIconStyleClass(this.isItemOpened(doc), doc);
		const iconEl = itemContent.find('.' + this.getIconClass());
		const textEl = itemContent.find('.treeitemtext-detail-text');
		const markerLeftEl = itemContainer.find('.' + this.getItemLeftMarkerClass());
		const markerRightEl = itemContainer.find('.' + this.getItemRightMarkerClass());
		const dragHandleMobile = itemContainer.find('.' + this.getDragHandleMobileClass());

		// Dimensions for the first element
		const parentWidth = this.treeFontSize * 2;
		const selectedHeight = this.getSelectedItemHeight();

		// Group marker (disabled here by default, this is set after filtering)
		groupMarker.css('display', 'none');
		
		// Category markers
		markerLeftEl.css('display', 'none');
		markerLeftEl.css('width', '16px');
		markerLeftEl.css('color', 'darkgrey');
		markerRightEl.css('display', 'none');
				
		// Mobile drag handles
		dragHandleMobile.css('display', (!meta.isParentOfSelectedParent && !meta.isSelectedParent) ? 'flex' : 'none');
					
		var markerShown = false;
		if ((!meta.isSelectedParent) && (this.mode == 'ref')) {
			
			function showMarker(markerEl, left) {
				if (markerShown) return;
				markerShown = left ? 'l' : 'r';
				
				markerEl.css('display', 'block');
				markerEl.css('height', '100%');
				markerEl.css('top', '0px');
			}

			// Markers at the right for children, outgoing links of the selected doc. and parent of the selected doc.
	 		if (!isParentOfSelected) {
				if (isChildOfSelected) {
					showMarker(markerRightEl, false);
					markerRightEl.css('background', '#eeeeee');
					markerRightEl.attr('title', 'Child of ' + selectedDocName + ' in the hierarchy');
				} 
				else if (isOutgoinglinkOfSelected) {
					showMarker(markerRightEl, false);
					markerRightEl.css('background', '#b5f7c6');
					markerRightEl.attr('title', 'Outgoing link from ' + selectedDocName + ' to ' + doc.name);
				}
			}
			
			// Marker at the left for backlinks and and references
			const markerLeftElIcon = markerLeftEl.find('.' + this.getMarkerIconClass());
			markerLeftElIcon.css('font-size', '10px');
			markerLeftElIcon.removeClass('fa-level-up-alt');
			markerLeftElIcon.removeClass('fa-chevron-right');
			markerLeftElIcon.removeClass('fa-chevron-down');
			//var leftMarkerColor = 'darkgrey';

			if (isParentOfSelected) {
				showMarker(markerLeftEl, true);
				markerLeftEl.css('background', '#faacac');
				markerLeftEl.css('width', parentWidth + 'px');
				markerLeftEl.attr('title', 'Back to ' + (parentDoc ? parentDoc.name : this.rootDocument.name));
				//leftMarkerColor = 'black';
				
				markerLeftElIcon.css('font-size', this.treeFontSize + 'px');
				markerLeftElIcon.addClass('fa-level-up-alt');
			}
			else if (isBacklinkOfSelected) {
				showMarker(markerLeftEl, true);
				markerLeftEl.css('background', '#b5f7c6');
				markerLeftEl.attr('title', 'Link from ' + doc.name + ' to ' + selectedDocName);
				
				markerLeftElIcon.addClass('fa-chevron-right');
			}
			else if (isReferenceToSelected) {
				showMarker(markerLeftEl, true);
				markerLeftEl.css('background', '#fff2bf');
				markerLeftEl.attr('title', doc.name + ' contains a reference to ' + selectedDocName);
				
				markerLeftElIcon.addClass('fa-chevron-right');
			}				
			else if (isSiblingOfSelected) {
				showMarker(markerLeftEl, true);
				markerLeftEl.css('background', '#b1f4fa');
				markerLeftEl.attr('title', 'Sibling of ' + selectedDocName + ' in the hierarchy');
				
				markerLeftElIcon.addClass('fa-chevron-down');
			}
									
			// Highlight last selected
			/*const highlightColor = '#fada4d';
			const highlightLeft = (!isParentOfSelected) && (doc._id == this.lastSelectedParent);
			const highlightRight = highlightLeft;
			markerLeftEl.css('border', highlightLeft ? ('2px solid ' + highlightColor) : '');
			markerLeftEl.css('color', highlightLeft ? highlightColor : leftMarkerColor);
			if (highlightLeft) markerLeftEl.attr('title', markerLeftEl.attr('title') + ', last opened in navigation');
			
			markerRightEl.css('border', highlightRight ? ('2px solid ' + highlightColor) : '');
			markerRightEl.css('color', highlightRight ? highlightColor : 'darkgrey');
			if (highlightRight) markerRightEl.attr('title', markerRightEl.attr('title') + ', last opened in navigation');
			*/
		}
		
		// Item dimensions. Parent shall be small (like font size), the normal items should be larger.
		if (meta.isSelectedParent) {
			// Selected parent
			itemHeader.css('margin-top', ((selectedHeight - this.treeFontSize * 1.4) / 2) + 'px');   // NOTE: 1.4 is the global line height!
			itemHeader.css('display', 'block');
			textEl.css('padding-left', (this.treeFontSize / 4) + 'px');
			
			itemContent.css('height', selectedHeight + 'px');
			itemContent.css('padding-right', '0px');
			itemContainer.css('width',(this.containerWidthBuffer - this.sortButtonsWidth - (isRoot ? 0 : parentWidth)) + 'px');
		} else {
			itemContent.css('padding-right', '10px');
			itemHeader.css('margin-top', '0px');
			itemHeader.css('display', 'flex');
			textEl.css('padding-left', (this.treeFontSize / 4) + 'px');
			
			if (isParentOfSelected) {
				// Parent of selected
				itemContent.css('height', selectedHeight + 'px');
				itemContainer.css('width', parentWidth + 'px');
			} else {
				// Normal item
				itemContent.css('height', ((this.itemHeight) + 'px'));
				itemContainer.css('width', '100%');
			}
		}
		
		// Styling for icons (here we dont want no spaces when the icon is hidden)
		const poss = this.getAllPossibleIconStyleClasses();
		for(var p in poss) iconEl.toggleClass(poss[p], false);
		
		iconEl.toggleClass(iconClass, true); 

		iconEl.css('padding-right', iconClass ? '10px' : '0px'); 
		iconEl.toggleClass('folder', hasChildren);
		iconEl.css('display', ((!this.enableParents) || (!meta.isSelectedParent)) ? (iconClass ? 'block' : 'none') : 'none');

		// Inner container
		innerContainer.css('margin-top', meta.isSelectedParent ? '0px' : '2px');
		innerContainer.css('margin-bottom', meta.isSelectedParent ? '0px' : '2px');
		innerContainer.css('width', meta.isSelectedParent ? '100%' : ((markerShown == 'r') ? ((this.containerWidthBuffer - 45) + 'px') : ''));

		// Header line
		itemHeader.css('max-width', 
			meta.isSelectedParent 
			? '100%' 
			: (
				(this.containerWidthBuffer
					- ((markerShown == 'r') ? (45) : 0) 
					- ((markerShown == 'l') ? (50) : 0) 
					- (iconClass ? (10 + this.treeFontSize) : 0)
				) + 'px'
			)
		);

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
		
		// Star
		const starEl = innerContainer.find('.doc-label-detail-star');
		starEl.css('display', doc.star ? 'block' : 'none');
		if (doc.star) {
			starEl.css('color', doc.color ? doc.color : 'black');
			starEl.css('font-size', (this.treeFontSize - 2) + 'px');
		}
		
		this.updateItemMeta(doc, itemContent);

		const tags = itemContent.find('.doc-hashtag');
		tags.css('min-width', this.treeFontSize + 'px');
		tags.css('max-width', this.treeFontSize + 'px');
		tags.css('min-height', this.treeFontSize + 'px');
		tags.css('max-height', this.treeFontSize + 'px');

		this.setItemLabelAlignment(itemContent, !meta.isSelectedParent);
		
		const showSelector = this.multiSelect && (!meta.isParentOfSelectedParent);
		itemContent.find('.' + this.getSelectorClass()).css('display', showSelector ? 'inline-block' : 'none');
		
		// Dragging enabled for this item?
		const enableDrag = !isParentOfSelected && !meta.isSelectedParent;
		if (enableDrag) {
			this.grid.grid.itemEnableDrag(muuriItem);		
		} else {
			this.grid.grid.itemDisableDrag(muuriItem);
		}	

		// Height of the preview element (must be set here because of CSS rendering bugs in iOS webkit)	TODO remove if no problems arise				
		/*const soll = itemContent.offset().top + itemContent.height();
		const ist = previewEl.offset().top + previewEl.height();
		const diff = ist - soll;
		if (diff > 0) {
			var previewHeight = previewEl.height() - diff; 
			previewEl.css('height', previewHeight);		
		}
		*/		
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
		const show = this.#doShowItem(doc);
		
		// If a search is going on, we show all items the search is positive for
		if (searchText) {
			const meta = this.getItemRefTypeDescriptor(doc);
			
			return this.#app.data.evaluateSearch(doc, searchText, show && !meta.isParentOfSelectedParent);
		} else {
			return show;
		}
	}
	
	#doShowItem(doc) {
		var d = this.#app.data;
		var selectedDoc = d.getById(this.selectedParent);
		
		if (this.selectedParent == doc._id) return true;
		
		if (this.enableChildren || (this.mode != 'ref')) {
			// Show children of the selected document
			if (this.selectedParent == doc.parent) {
				return true;
			} 
		}
		
		if (this.mode != 'ref') return false;
		
		//var selectedDoc = d.getById(this.selectedParent);
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
		
		if (this.enableSiblings) {
			if (selectedDoc.parent == doc.parent) return true;
		}

		return false;
	}
	
	/**
	 * Returns what is regarded as backlink here
	 */
	getBacklinks(doc) {
		return this.#app.data.getBacklinks(doc)
	}
	
	/**
	 */
	hasBackLinkTo(doc, targetId) {
		return this.#app.data.hasBackLinkTo(doc, targetId);
	}
	
	/**
	 * For a given document, this returns the siblings currently visible.
	 */
	getParentId(doc) {
		if (this.mode == 'ref') return this.selectedParent;
		return doc.parent;
	}
	
	/**
	 * Get currently focussed ID.
	 */
	getFocusedId() {
		return this.selectedParent ? this.selectedParent : '';
	}
	
	/**
	 * Returns if the document can be moved or if it is just a link or backling etc.
	 * Only true children can be moved.
	 */
	canBeMoved(id) {
		if (!id) return false;
		
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Cannot find document ' + id);
		
		return (doc.parent == this.selectedParent);
	}
	
	/**
	 * Returns all documents which are visible in ref mode.
	 */
	getRefEntries(doc, ignoreParent, options) {
		var d = this.#app.data;
		
		if (!options) options = this;
		
		var ret = [];
		
		if (options.enableChildren) {
			var children = d.getChildren(doc ? doc._id : '');
			for(var i=0; i<children.length; ++i) {
				ret.push(children[i]);
			}
		}
		
		if (!doc) return ret;
		
		if (options.enableRefs) {
			var rs = d.getReferencesTo(doc._id);
			for(var i=0; i<rs.length; ++i) {
				if (rs[i].parent) {
					if (ignoreParent && (rs[i].parent == doc.parent)) continue;
					
					var rp = d.getById(rs[i].parent);
					ret.push(rp);
				}
			}
		}
		
		if (options.enableParents && !ignoreParent) {
			if (doc.parent) {
				var p = d.getById(doc.parent);
				if (p) {
					ret.push(p);
				}
			}
		}
		
		var refs = d.getAllReferences(doc);
		if (options.enableLinks) {
			for(var r=0; r<refs.length; ++r) {
				if (refs[r].type != 'link') continue;
				
				if (ignoreParent && (refs[r].id == doc.parent)) continue;
				
				var rdoc = d.getById(refs[r].id);
				if (rdoc) {
					ret.push(rdoc);
				}
			}
		}
		
		if (options.enableBacklinks) {
			var backlinks = this.getBacklinks(doc);
			for(var r=0; r<backlinks.length; ++r) {
				if (ignoreParent && (backlinks[r].doc._id == doc.parent)) continue;
				
				ret.push(backlinks[r].doc);
			}
		}
		
		if (options.enableSiblings && doc) {
			var siblings = d.getChildren(doc.parent);
			for(var r=0; r<siblings.length; ++r) {
				if (siblings[r]._id == doc._id) continue;
				
				ret.push(siblings[r]);
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
	hasChildren(doc, ignoreParent) {
		if (this.enableParents && (!ignoreParent)) {
			/*if (doc.parent) {
				var p = d.getById(doc.parent);
				if (p) {
					return true;
				}
			}*/
			return true;
		}
		
		var d = this.#app.data;

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
		
		if (this.enableSiblings) {
			var siblings = d.getChildren(doc.parent);
			for(var r=0; r<siblings.length; ++r) {
				if (siblings[r].doc._id == doc._id) continue;
				
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
			var doc = this.#app.data.getById(id);
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
		
		return !this.#app.data.isChildOf(tarId, srcId);
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
	
	static iconClassBoard = 'fa fa-border-all';                      // #IGNORE static 
	static iconClassFolderClosed = 'fa fa-plus';                     // #IGNORE static 
	static iconClassFolderOpened = 'fa fa-chevron-left';             // #IGNORE static 
	static iconClassAttachment = 'fa fa-paperclip';                  // #IGNORE static 
	static iconClassReference = 'fa fa-long-arrow-alt-right';        // #IGNORE static 
	
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
		if (doc.type == 'reference') return DetailBehaviour.iconClassReference;
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
	
	getNewItemStartIndex(parentItemIndex) {
		return 0;		
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
	 * Returns the class used as handle for dragging (for mobiles)
	 */
	getDragHandleClass() {
		return "detailDragHandle"; 
	}
	
	getDragMarkerClass() {
		return this.#app.device.isTouchAware() ? this.getDragHandleClass() : this.getDragHandleMarkerClass();
	}
	
	getDragHandleMobileClass() {
		return "detailDragHandleMobile";
	}
	
	/**
	 * Returns the class used as handle for dragging (in Desktop mode)
	 */
	getDragHandleMarkerClass() {
		return "detailDragHandleDesktop"; 
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
	
	/*getMoveHandleClass() {
		return 'treemovehandle-detail';
	}*/
	
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
		
		var d = this.#app.data;
		var selectedDoc = d.getById(this.selectedParent);
		
		return [
			$('<tr></tr>')
			.append(
				$('<td>Show Children</td>'),
				$('<td colspan="2" />')
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
									that.#app.state.saveTreeState();
									that.grid.filter();
								}
							});
						}, 0);
					}),
					
					//$('<span class="treesettingsinfo-detail"></span>').html('(' + d.getChildren(selectedDoc ? selectedDoc._id : '').length + ')')
				)
			),
			
			$('<tr></tr>')
			.append(
				$('<td>Show Siblings</td>'),
				$('<td colspan="2" />')
				.append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.enableSiblings ? 'checked' : '') + ' />')
					.each(function(i) {
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									that.enableSiblings = !!this.getChecked();
									that.#app.state.saveTreeState();
									that.grid.filter();
								}
							});
						}, 0);
					}),
					
					//$('<span class="treesettingsinfo-detail"></span>').html('(' + d.getSiblings(selectedDoc ? selectedDoc._id : '').length + ')')
				)
			),
			
			/*
			$('<tr></tr>')
			.append(
				$('<td>Show Parents</td>'),
				$('<td colspan="2" />')
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
									that.#app.state.saveTreeState();
									that.grid.filter();
								}
							});
						}, 0);
					}),
				)
			),*/
			
			$('<tr></tr>')
			.append(
				$('<td>Show Outgoing Links</td>'),
				$('<td colspan="2" />')
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
									that.#app.state.saveTreeState();
									that.grid.filter();
								}
							});
						}, 0);
					}),
					
					//$('<span class="treesettingsinfo-detail"></span>').html('(' + ((selectedDoc && selectedDoc.links) ? selectedDoc.links.length : 0) + ')')
				)
			),
			
			$('<tr></tr>')
			.append(
				$('<td>Show Backlinks</td>'),
				$('<td colspan="2" />')
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
									that.#app.state.saveTreeState();
									that.grid.filter();
								}
							});
						}, 0);
					}),
					
					//$('<span class="treesettingsinfo-detail"></span>').html('(' + (d.getBacklinks(selectedDoc).length) + ')')
				)
			),
			
			$('<tr></tr>')
			.append(
				$('<td>Show References</td>'),
				$('<td colspan="2" />')
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
									that.#app.state.saveTreeState();
									that.grid.filter();
								}
							});
						}, 0);
					}),
					
					//$('<span class="treesettingsinfo-detail"></span>').html('(' + (d.getReferencesTo(selectedDoc ? selectedDoc._id : null).length) + ')')
				)
			),
			
			$('<tr></tr>')
			.append(
				$('<td>Highlight last selected item</td>'),
				$('<td colspan="2" />')
				.append(
					$('<input class="checkbox-switch" type="checkbox" ' + (this.#app.state.getViewSettings().detailHighlightLastSelected ? 'checked' : '') + ' />')
					.each(function(i) {
						var that2 = this;
						setTimeout(function() {
							new Switch(that2, {
								size: 'small',
								onSwitchColor: '#337ab7',
								disabled:  false,
								onChange: function() {
									const nv = !!this.getChecked();
									
									var vs = that.#app.state.getViewSettings(); 
									vs.detailHighlightLastSelected = nv;
									that.#app.state.saveViewSettings(vs);
									
									that.grid.filter();
								}
							});
						}, 0);
					}),
					
					//$('<span class="treesettingsinfo-detail"></span>').html('(' + (d.getReferencesTo(selectedDoc ? selectedDoc._id : null).length) + ')')
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
	
	/**
	 * Returns all related documents (children etc.) for the passed document.
	 */
	getRelatedDocuments(id, options) {
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Document ' + id + ' not found');
		
		var children = (this.mode == 'ref') ? this.getRefEntries(doc, true, options) : d.getChildren(id);
		
		children.sort(this.compareDocuments);
		
		return children;
	}
	
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Select a new parent
	 */
	selectParent(id, fromLinkage, noHistoryAdd) {
		if (this.selectedParent == id) return;
		
		// If we go deeper in the tree, we also reset the scroll position.
		if (id) {
			var docIn = this.#app.data.getById(id);
			var doc = Document.getTargetDoc(docIn);
			if (doc && (doc.parent == old)) {
				this.resetScrollPosition();
			}
			if (doc) id = doc._id;
		}
		
		var old = this.selectedParent;
		
		this.lastSelectedParent = this.selectedParent;
		
		console.log(' -> Navigation: Select ' + id);
		this.selectedParent = id;

		if (!noHistoryAdd) this.addParentToHistory(this.selectedParent);

		this.grid.filter();
		this.grid.setSelected();
		
		this.grid.refreshColors();
		
		this.updateSortButtons();
		
		this.grid.updateHistoryButtons();
		
		if (this.grid.getSearchText().length > 0) {
			this.grid.setSearchText('');
		}
		
		if (!fromLinkage) {
			// Open in editor when linked
			if ((!this.#app.device.isLayoutMobile()) && (this.#app.state.getLinkageMode('editor') == 'on')) {
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
		itemElement.find('.' + this.getItemInnerContainerClass() + ', .' + this.getItemLeftMarkerClass() + ', .' + this.getItemRightMarkerClass()).each(function(i) {
			this.mainEvent = new TouchClickHandler(this, {
				onGestureFinishCallback: function(event) {
					return that.onTreeEvent(event);
				},
				
				delayedHoldCallback: function(event) {
					if (that.multiSelect) return;
					
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
					if (that.multiSelect) return;
					
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
					e.stopPropagation();
					
					var data = $(e.currentTarget).parent().parent().parent().parent().data();
					if (data.id == that.selectedParent) {
						that.selectAllVisibleItems(this.checked);
					} else {
						that.updateSelectAllState();
					}

					that.callOptionsWithId(that.getSelectedIds(), Tools.extractX(e), Tools.extractY(e));
				}
			});
		});
	}
	
	selectAllVisibleItems(doSelect) {
		$('.' + this.getSelectorInputClass())
		.each(function() {
			this.checked = doSelect;
		});
	}
	
	updateSelectAllState() {
		var that = this;
		$('.' + this.getSelectorInputClass())
		.each(function() {
			var data = $(this).data();
			if (!data) return;
			
			if (data.id == that.selectedParent) {
				this.checked = false;
			}
		})
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
			this.#app.hideOptions();
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

		this.grid.itemClicked(event, data.id);
		
		this.saveScrollPosition();
		
		if (this.multiSelect) {
			this.toggleSelected(data.id);
			this.callOptionsWithId(this.getSelectedIds(), Tools.extractX(event), Tools.extractY(event));
			return;
		}
		
		if (this.#app.hideOptions()) return;

		var doc = this.#app.data.getById(data.id);
		if (!doc) {
			if (this.mode == 'ref') {
				this.selectParentFromEvent('');
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
				this.selectParentFromEvent(doc.parent);
			}
		} else {
			if (this.mode == 'ref') {
				var selectedDoc = this.#app.data.getById(this.selectedParent);
				if (selectedDoc && selectedDoc.parent && (selectedDoc.parent == data.id)) {
					// Parent if selected: do not open, navigate back.
					this.selectParentFromEvent(data.id);
					return;
				}
			}
					
			this.grid.setSelected(data.id);
			this.grid.openNode(data.id);
		}
	}
	
	/**
	 * Handle the tree select event.
	 */
	onTreeEvent(event) {
		var data = $(event.currentTarget).parent().data();
		
		this.grid.itemClicked(event, data.id);

		this.saveScrollPosition();

		if (this.multiSelect) {
			this.toggleSelected(data.id);
			this.callOptionsWithId(this.getSelectedIds(), Tools.extractX(event), Tools.extractY(event));
			return;
		}

		if (this.#app.hideOptions()) return;

		var doc = this.#app.data.getById(data.id);
		if (!doc) {
			if (this.mode == 'ref') {
				this.selectParentFromEvent('');
				return;
			} else {
				throw new Error("Doc " + data.id + " not found");
			}
		} 
		
		// Select as parent in navigation
		if (this.hasChildren(doc)) {
			if (this.selectedParent == data.id) {
				// Click on parent: Close it
				this.selectParentFromEvent(doc.parent);
			} else {
				// Click on item: Open it
				this.selectParentFromEvent(data.id);
			}
			
		} else {
			this.grid.setSelected(data.id);
			this.grid.openNode(data.id);
		}
	}
	
	selectParentFromEvent(id, fromLinkage, noHistoryAdd) {
		if (this.#app.device.isLayoutMobile()) {
			this.#app.routing.callProfileRootWithSelectedId(id);
		} else {
			this.selectParent(id, fromLinkage, noHistoryAdd);
		}
	}
	
	/**
	 * Called when the user double clicks on the tree area
	 */
	onNavigationDoubleClick() {
		this.selectParent("");
	}
}
	