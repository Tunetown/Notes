/**
 * Kanban Board style editor. Inspired by https://codepen.io/niklasramo/pen/BrYaOp
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
class BoardEditor extends Editor {

	#current = null;             // Current docuemnt

	#boardGrid = null;           // Main grid instance
	#columnGrids = [];           // Array of column grid instances
	#scrollContainer = null;     // Scroll container JQuery element
	
	#imageDialog = null;
	
	/**
	 * Tells that the editor needs tree data loaded before load() is called.
	 */
	needsHierarchyData() {
		return true;
	}
	
	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentId() {
		return this.#current ? this.#current._id : false;
	}

	/**
	 * Returns the ID of the loaded note, if any, or false if none is loaded.
	 */
	getCurrentDoc() {
		return this.#current;
	}
	
	/**
	 * Returns the editor mode for this.
	 */
	getEditorMode() {
		return 'board';
	}
	
	/**
	 * Return current HTML content of the editor. (In this case, the board document does
	 * not evaluate the content, so we just return the document's content as-is)
	 */
	getContent() {
		return this.#current ? Docment.getContent(this.#current) : ""; 
	}
	
	/**
	 * Unloads the editor
	 */
	async unload() {
		this._app.registerOptionsCallbacks({
			id: this.getEditorMode()
		});
		
		this._app.callbacks.deleteCallbacks(this.getEditorMode());
				
		this.#current = null;
		this.#destroy();
		
		this._app.update();  // TODO still necessary?
	}
	
	/**
	 * Loads the given data into the editor (which also is initialized here at first time).
	 */
	async load(doc) {
		if (!this.#imageDialog) {
			this.#imageDialog = new ImageDialog(this._app);
		}
		
		var that = this;

		// Callbacks for color picking
		this._app.registerOptionsCallbacks({
			id: this.getEditorMode(),
			
			onColorInputUpdate: function(doc, back, input) {
				that.#refreshColors(doc._id);
			},
		});
		
		// Callbacks for actions
		this._app.callbacks.registerCallback(
			this.getEditorMode(),
			'delete',
			function(id) {
				that.#refresh();
			}
		);
		this._app.callbacks.registerCallback(
			this.getEditorMode(),
			'copy',
			function(id) {
				that.#refresh();
			}
		);
		this._app.callbacks.registerCallback(
			this.getEditorMode(),
			'moveDocumentAfterSave',
			function(id) {
				that.#refresh();
			}
		);
		this._app.callbacks.registerCallback(
			this.getEditorMode(),
			'rename',
			function(id) {
				that.#refresh();
			}
		);
		this._app.callbacks.registerCallback(
			this.getEditorMode(),
			'create',
			function(id) {
				that.#refresh();
			}
		);
		this._app.callbacks.registerCallback(
			this.getEditorMode(),
			'setBoardBackgroundImage',
			function(id) {
				that.#refresh();
			}
		);
		
		// Build buttons
		this._app.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Board options..." class="fa fa-ellipsis-v"></div>')
			.on('click', function(event) {
				event.stopPropagation();
				that.#callPageOptions();
			}), 
		]);
		
		var docs = [doc];
		var children = this._app.data.getChildren(doc._id);
		
		for(var c in children) {
			docs.push(children[c]);
			
			var subChildren = this._app.data.getChildren(children[c]._id);
			for (var sc in subChildren) {
				docs.push(subChildren[sc]);
			}
		}
		
		await this._app.documentAccess.loadDocuments(docs);

		this.#current = doc;

		// Show loaded note in the header bar 
		var txt = "";
		if (doc) txt = doc.name + (this._app.device.isLayoutMobile() ? "" : " (" + new Date(doc.timestamp).toLocaleString() + ")");
		this._tab.setStatusText(txt);
	
		// Build board
		this.#buildBoard(doc);
		
		this._app.nav.updateFavorites();
		
		this.#restoreScrollPosition();
	}
	
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Check basic property correctness TODO solve otherwise
	 */
	static checkBasicProps(doc, errors) {
		if (doc.boardBackground) {  // This is relevant for all documents!
			errors.push({
				message: 'Document contains deprecated boardBackground reference',
				id: doc._id,
				type: 'W',
				solverReceipt: [{
					action: 'deleteProperty',
					propertyName: 'boardBackground'
				}]
			});		
		}
	}

	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Build the board DOM
	 */
	#buildBoard(doc) {
		var that = this;
		
		// Build containers
		var dragContainer = $('<div class="board-drag-container"></div>');
		var boardContainer = $('<div class="board"></div>');
		var boardBack = $('<div class="boardBackground" style="display:none"></div>');
		this.#scrollContainer = $('<div class="board-scroll-container"></div>');
		
		var container = this._tab.getContainer();
		container.empty();
		
		// Add background and content container. Default is light grey.
		
		container.css('background', 'lightgrey');
		container.append(
			boardBack,
			
			this.#scrollContainer.append(
				dragContainer,
				$('<div class="board-container"></div>').append(
					boardContainer
				)
			)
		);

		// Right click on background
		container.contextmenu(function(e) {
			e.preventDefault();
			e.stopPropagation();
			
			that._app.callOptions([doc._id], Tools.extractX(e), Tools.extractY(e), {
				noCopy: true,
				noMove: true,
				noDelete: true,
				noBgColor: true,
				noColor: true,
				noBgImage: true
			});
		});
		
		// Asyncronously load the background image, if any
		that._app.actions.board.getBoardBackground(doc._id)
		.then(function(imageData) {
			Document.setBackground(imageData, false, boardBack);
			boardBack.css('display', 'block');
		})
		.catch(function(err) {
			if (err && (err.status == 404)) {
				return;
			}
			that._app.errorHandler.handle(err);
		})
		
		// Build board DOM structure first
		var containerHeight = container.height() - 35;
		var mobileWidth = container.width() - 40;
		if (mobileWidth > 300) mobileWidth = 300;
		
		var lists = that._app.data.getChildren(doc._id);
		Document.sortHierarchically(lists);
		
		var boardWidth = 0;		
		var itemElements = [];
		var itemHdrs = [];
		
		for(var l in lists) {
			if (lists[l]._id == doc.boardBackground) continue;
			
			// Column items
			var items = [];
			var subList = that._app.data.getChildren(lists[l]._id);
			Document.sortHierarchically(subList);
			
			for(var i in subList) {
				if (subList[i]._id == doc.boardBackground) continue;
				
				// Colors for items
				var itemContent = $('<div class="board-item-content" data-id="' + subList[i]._id + '"></div>');
				Document.setItemBackground(subList[i], itemContent, subList[i].backColor ? subList[i].backColor : 'white');
				if (subList[i].color) itemContent.css('color', subList[i].color);
				
				var itemIconClass = this.#getItemIconClass(subList[i]);
				
				var itemEl = $('<div class="board-item"></div>');
				var itemHdr = $('<div class="board-item-content-header"></div>')

				itemElements.push(itemEl);
				itemHdrs.push(itemHdr);
				
				var preview = (subList[i].preview ? subList[i].preview : '');
				
				items.push(
					itemEl.append(
						itemContent.append(
							itemHdr.append(
								!itemIconClass ? null : $('<div class="board-item-content-header-icon fa ' + itemIconClass + '"></div>'),
								$('<div class="board-item-content-header-text"></div>')
									.html(subList[i].name)
									
									// Right click on header of item
									.contextmenu(function(e) { 
										e.preventDefault();
							    		e.stopPropagation();
							    		
							    		that.#saveScrollPosition();
							    		
							    		var data = $(e.currentTarget).parent().parent().data();

										that._app.callOptions(
											[data.id], 
											Tools.extractX(e), 
											Tools.extractY(e),
											{
												showInNavigation: true
											}
										);
									}),
									
								Document.getTagElements(subList[i], 'doc-hashtag-board')
							),
							
							$('<div class="board-item-content-preview">' + preview + '</div>')
							.each(function(i) {
								// Select
								this.selectEvent = new TouchClickHandler(this, {
									onGestureFinishCallback: function(event) {
										var data = $(event.currentTarget).parent().data();
										
										that.#saveScrollPosition();
										
										if (that._app.hideOptions()) return;										
										
										// Open the document
										that._app.routing.call(data.id);
									},
									
									delayedHoldCallback: function(event) {
										var data = $(event.currentTarget).parent().data();

										that._app.callOptions([data.id], Tools.extractX(event), Tools.extractY(event));
									},
									delayHoldMillis: 600
								});
								
								// Right click on item itself
								$(this).contextmenu(function(e) {
									e.preventDefault();
						    		e.stopPropagation();

						    		that.#saveScrollPosition();
						    		
						    		var data = $(e.currentTarget).parent().data();
						    		
									that._app.callOptions(
										[data.id], 
										Tools.extractX(e), 
										Tools.extractY(e),
										{
											showInNavigation: true
										}
									);
								});
							})
						)
					)
				);
			}

			var isCollapsed = lists[l].boardState && lists[l].boardState.collapsed;
			var icon = isCollapsed ? 'fa-chevron-down' : 'fa-chevron-right';
			
			// Colors for columns
			var colHdr;
			if (isCollapsed) {
				colHdr = $('<div class="board-column-collapsed"></div>').append(
					$('<div class="board-column-header-collapsed-content"></div>')
					.css('max-height', (containerHeight - 36) + 'px')
					.append(
						$('<div class="board-column-header-minimize-collapsed-icon fa ' + icon + '" data-id="' + lists[l]._id + '"></div>')
						.on('click', function(event) {
							var id = $(this).data().id;
							if (!id) return;
							
							that.#toggleExpandedState(id);
						}),

						$('<div class="board-column-header-minimize-collapsed-headline"></div>')
						.html(lists[l].name),
						
						$('<span class="board-column-header-minimize-collapsed-headline-meta"></span>')
						.html(
							(subList.length == 0) ?
								'No Entries' :
								(subList.length + ((subList.length == 1) ? ' Entry' : ' Entries'))
						)
					)
				);
			} else {
				colHdr = $('<div class="board-column-header"></div>').append(
					$('<div class="board-column-header-content"></div>')
					.html(lists[l].name)
					.append(
						$('<div class="board-column-header-minimize-icon fa ' + icon + '" data-id="' + lists[l]._id + '"></div>')
						.on('click', function(event) {
							event.stopPropagation();
							
							var id = $(this).data().id;
							if (!id) return;
							
							that.#toggleExpandedState(id);
						})
					)
					.each(function(i) {
						// Select
						this.selectEvent = new TouchClickHandler(this, {
							delayedHoldCallback: function(event) {
								var data = $(event.currentTarget).parent().parent().data();
								that.#saveScrollPosition();
			
								// Do not show options when the item is inside a hidden board
								var doc = that._app.data.getById(data.id);
								if (!doc || (doc.boardState && doc.boardState.collapsed)) return;
								
								that._app.callOptions([data.id], Tools.extractX(event), Tools.extractY(event));
							},
							delayHoldMillis: 600,
							dontStopPropagation: true
						});
						
						// Right click
						$(this).contextmenu(function(e) {
							e.preventDefault();
			        		e.stopPropagation();
			        		
			        		that.#saveScrollPosition();
			        		
			        		var data = $(e.currentTarget).parent().parent().data();
			
		        			that._app.callOptions(
		        				[data.id], 
		        				Tools.extractX(e), 
		        				Tools.extractY(e),
								{
									showInNavigation: true
								} 
		        			);
						});
					})	
				);
			}
			
			// Colors for list headers
			Document.setItemBackground(lists[l], colHdr, lists[l].backColor ? lists[l].backColor : 'black');
			if (lists[l].color) colHdr.css('color', lists[l].color);
			
			var itemWidth;
			if (isCollapsed) itemWidth = 50;
			else itemWidth = that._app.device.isLayoutMobile() ? mobileWidth : 300;  // TODO make last one adjustable
			boardWidth += itemWidth + 10;
			
			var boardCol = $('<div class="board-column" data-id="' + lists[l]._id + '"></div>');
			
			// Columns
			boardContainer.append(
				boardCol
				.css('width', itemWidth + 'px') 
				.css('max-height', containerHeight + 'px')
				.append(
					$('<div class="board-column-container" data-id="' + lists[l]._id + '"></div>')
					.css('max-height', containerHeight + 'px')
					.append([
						colHdr,
						isCollapsed ? null : $('<div class="board-content-wrapper" data-id="' + lists[l]._id + '"></div>')
						.css('max-height', (containerHeight - 50) + 'px')
						.append(
							$('<div class="board-column-content" data-id="' + lists[l]._id + '"></div>')
							.contextmenu(function(event) {
								event.stopPropagation();
								event.preventDefault();
								
								var data = $(event.currentTarget).parent().parent().data();
								
								that._app.callOptions([data.id], Tools.extractX(event), Tools.extractY(event));
							})
							.append(items)
						)
					])
				)
				.contextmenu(function(e) {
					// Kills the right click on column backgrounds
					e.stopPropagation();
					e.preventDefault();
				})
			);
			
			// Drop files into the list
			Tools.dropFilesInto([
				{
					elements: boardCol,
					callback: function(files, definition, element) {
						var id = $(element).data().id;
						var lst = that._app.data.getById(id);
						if (!lst) {
							return;
						}
						
						console.log("Dropped " + files.length + " files into " + lst.name);
						
						that.#uploadFilesHandler(files, id);
					}
				}
			]);

			//this.updateExpandedState(lists[l]._id);
		}

		// Set container size so that only horizontal layouting takes place (the horizontal option of Muuri seems not to work properly)
		$('.board-container').css('min-width', (boardWidth + 10) + "px");

		var tags = $('.doc-hashtag');
		tags.css('min-width', "16px");
		tags.css('max-width', "16px");
		tags.css('min-height', "16px");
		tags.css('max-height', "16px");
		
		// Item height in general
		if (itemElements.length != itemHdrs.length) throw new Error('Internal error creating Board: item element mismatch');
		for(var i in itemElements) {
			itemElements[i].height((itemHdrs[i].height() + 60) + 'px');
		}
		
		// Initialize the column grids so we can drag those items around.
		var itemContainers = boardContainer.find('.board-column-content');
		this.#columnGrids = [];

		itemContainers.each(function (i) {
			var colId = $(itemContainers[i]).data().id;
			var grid = new Muuri(itemContainers[i], {
				items: '.board-item',
				dragEnabled: true,
				dragSort: function () {
					return that.#columnGrids;
				},
				dragHandle: '.board-item-content-header-text',
				dragContainer: dragContainer[0],
				dragStartPredicate: {
					distance: 0,
					delay: that._app.device.isLayoutMobile() ? 200 : 0,  // Prevents false item moves on mobiles
				},
				dragAutoScroll: {
					targets: (item) => {
						return [
							{ 
								element: $('.board-content-wrapper[data-id=' + colId + ']')[0],
								priority: 0 
							},
							{ 
								element: that.#scrollContainer[0],   // TODO test this (auto scroll on dragging)
								priority: 1 
							},
						];
					},
					threshold: 50,
					safeZone: 0.6,
				},
				
				layout: {},
				
				containerClass: 'cmuuri',
				itemClass: 'cmuuri-item',
				itemVisibleClass: 'cmuuri-item-shown',
				itemHiddenClass: 'cmuuri-item-hidden',
				itemPositioningClass: 'cmuuri-item-positioning',
				itemDraggingClass: 'cmuuri-item-dragging',
				itemReleasingClass: 'cmuuri-item-releasing',
				itemPlaceholderClass: 'cmuuri-item-placeholder'
			})
			.on('dragInit', function (item) {
				item.oldWidth = item.getElement().style.width;
				item.oldHeight = item.getElement().style.height;
				item.getElement().style.width = item.getWidth() + 'px';
				item.getElement().style.height = item.getHeight() + 'px';
				
				that._hideOptions();
			})
			.on('dragReleaseEnd', function (item) {
				item.getElement().style.width = item.oldWidth;
				item.getElement().style.height = item.oldHeight;
				item.getGrid().refreshItems([item]);
				
				that.#saveOrder(); //item);
			})
			.on('layoutStart', function () {
				if (that.#boardGrid) that.#boardGrid.refreshItems().layout();
			});

			that.#columnGrids.push(grid);
		});

		// Initialize board grid so we can drag those columns around.
		this.#boardGrid = new Muuri(boardContainer[0], {
			dragEnabled: true,
			dragHandle: '.board-column-header',
			dragStartPredicate: {
				distance: 50,
				delay: this._app.device.isLayoutMobile() ? 200 : 0,  // Prevents false item moves on mobiles
			},
			dragAutoScroll: {
				targets: (item) => {
					return [
						{ 
							element: that.#scrollContainer[0],   // TODO test this (auto scroll on dragging)
							priority: 1 
						},
					];
				},
				threshold: 50,
				safeZone: 0.6,
			},
			
			containerClass: 'bmuuri',
			itemClass: 'bmuuri-item',
			itemVisibleClass: 'bmuuri-item-shown',
			itemHiddenClass: 'bmuuri-item-hidden',
			itemPositioningClass: 'bmuuri-item-positioning',
			itemDraggingClass: 'bmuuri-item-dragging',
			itemReleasingClass: 'bmuuri-item-releasing',
			itemPlaceholderClass: 'bmuuri-item-placeholder'
		})
		.on('dragInit', function (item) {
			that._hideOptions();
		})
		.on('dragReleaseEnd', function (item) {
			that.#saveOrder(); //item);
		});
		
		// Height of the preview element (must be set here because of CSS rendering bugs in iOS webkit)		
		$('.board-item-content-preview').each(function(i) {
			var itemContent = $(this).parent();
			
			var soll = itemContent.offset().top + itemContent.height();
			var ist = $(this).offset().top + $(this).height();
			var diff = ist - soll;
			
			if (diff != 0) {
				var previewHeight = $(this).height() - diff; 
				$(this).css('height', previewHeight);		
			}
		});
	}
	
	/**
	 * Handler for uploading files via drag and drop
	 */
	async #uploadFilesHandler(files, defaultId) {
		try {
			var id = await this._app.view.dialogs.promptSelectDocument('Add ' + files.length + ' files?', {
				defaultTargetId: defaultId,
				excludeTypes: ['reference']
			});
				
			this._app.actions.attachment.uploadAttachments(id, files);
			
			this._app.routing.call(this.getCurrentId()); // TODO this is not updating correctly after dropping files into board columns. You have to reload manually....
			
		} catch(err) {
			this._app.errorHandler.handle(err);
		}
	}

	/**
	 * Refresh board
	 */
	#refresh() {
		if (this.#current) this.load(this.#current);
	}
	
	/**
	 * Toggle the expanded state of the passed document ID
	 */
	#toggleExpandedState(id) {
		var doc = this._app.data.getById(id);
		if (!doc) return;
		
		if (!doc.boardState) doc.boardState = {};

		// Toggle
		doc.boardState.collapsed = !doc.boardState.collapsed;
		
		// Update
		this.#refresh();
		
		// Save state on DB
		var that = this;
		this._app.actions.board.saveBoardState(id, doc.boardState)
		.catch(function(err) {
			that._app.errorHandler.handle(err);
		});
	}

	/**
	 * Returns the fa class for the item icon, or falsy if no icon should be shown.
	 */
	#getItemIconClass(doc) {
		if (doc.type == 'attachment') return 'fa-paperclip';
		if (doc.type == 'reference') return 'fa-long-arrow-alt-right';
		if (doc.type == 'note' && doc.editor == 'board') return 'fa-border-all'; 
		if (this._app.data.hasChildren(doc._id)) return 'fa-plus';

		return null;
	}
	
	/**
	 * Refreshes all appearance attributes of the ID
	 */
	#refreshColors(id) {
		var d = this._app.data;
		
		var doc = d.getById(id);
		if (!doc) return;
		
		if (doc.parent == this.getCurrentId()) {
			// Columns
			var colCont = $('.board-column-container[data-id=' + id + ']');
			if (!colCont) return;
			
			var colHdr;
			if (doc.boardState && doc.boardState.collapsed) {
				colHdr = colCont.find('.board-column-collapsed');
			} else {
				colHdr = colCont.find('.board-column-header');
			}
			if (!colHdr) return;
			
			if (doc.backColor) colHdr.css('background-color', doc.backColor);
			if (doc.color) colHdr.css('color', doc.color);
		} else {
			// Items
			var itemContent = $('.board-item-content[data-id=' + id + ']');
			if (!itemContent) return;
			
			if (doc.backColor) itemContent.css('background-color', doc.backColor);
			if (doc.color) itemContent.css('color', doc.color);
		}
	}
	
	/**
	 * Kill the grids
	 */
	#destroy() {
		if (this.#boardGrid) {
			this.#boardGrid.destroy();
		}
		
		for(var i in this.#columnGrids || []) {
			this.#columnGrids[i].destroy();
		}
	}
	
	/**
	 * Re-layout the grids TODO cleanup
	 *
	#layout() {
		if (this.#boardGrid) this.#boardGrid.layout();
	
		for(var i in this.#columnGrids || []) {
			this.#columnGrids[i].layout();
		}
	}
	
	/**
	 * Scans all items and saves the ones that have changed parent or order
	 */
	#saveOrder() {
		if (!this.#boardGrid) return;
		if (!this.#columnGrids) return;
		
		this.#saveScrollPosition();
		
		if (this._app.optionsVisible()) return;
		
		var ids = [];
		var d = this._app.data;
		
		// Column orders
		var no = 1;
		var cItems = this.#boardGrid.getItems();
		for(var i in cItems) {
			var iid = $(cItems[i].getElement()).find('.board-column-container').data().id;
			if (!iid) continue;
			
			var doc = d.getById(iid);
			if (!doc) continue;
			
			var newOrder = no++;
			var oldOrder = Document.getRelatedOrder(doc);
			if (oldOrder != newOrder) {
				Document.setRelatedOrder(doc, false, newOrder);
				ids.push(iid);
			}
		}
		
		// Item orders and parents
		for(var c in this.#columnGrids || []) {
			var colId = $(this.#columnGrids[c].getElement()).data().id;
			
			no = 1;
			var iItems = this.#columnGrids[c].getItems();
			for(var i in iItems) {
				var iid = $(iItems[i].getElement()).find('.board-item-content').data().id;
				if (!iid) continue;
				
				var doc = d.getById(iid);
				if (!doc) continue;
				
				var newOrder = no++;
				var oldOrder = Document.getRelatedOrder(doc);
				var push = false;
				if (oldOrder != newOrder) {
					Document.setRelatedOrder(doc, false, newOrder);
					push = true;
				}
				if (doc.parent != colId) {
					d.setParent(iid, colId);
					push = true;
				}
				
				if (push) ids.push(iid);
			}
		}
		
		if (ids.length == 0) return;

		this._app.nav.destroy();
		this._app.nav.init(true);

		var that = this;
		this._app.documentAccess.saveItems(ids)
		.catch(function(err) {
			that._app.errorHandler.handle(err);
		});
	}
	
	/**
	 * Returns the current scroll position
	 */
	#getScrollPosition() {
		return {
			scrollX: this.#scrollContainer.scrollLeft(),
			scrollY: this.#scrollContainer.scrollTop()
		};
	}
	
	/**
	 * Saves the current scroll position.
	 */
	#saveScrollPosition() {
		this._app.state.saveBoardState(this.#getScrollPosition());
	}
	
	/**
	 * Restore the last saved scroll position
	 */
	#restoreScrollPosition() {
		var state = this._app.state.getBoardState();
		
		if (state.scrollX) this.#scrollContainer.scrollLeft(state.scrollX);
		if (state.scrollY) this.#scrollContainer.scrollTop(state.scrollY);
	}
	
	/**
	 * Calls the note options of the tree
	 */
	#callPageOptions() {
		var that = this;
		
		this.#saveScrollPosition();
		
		this._app.showMenu('editorOptions', function(cont) {
			cont.append(
				// Background image
				$('<div class="userbutton"><div class="fa fa-image userbuttonIcon"></div>Background Image</div>')
				.on('click', function(event) {
					event.stopPropagation();
					that._hideOptions();
					
					that.#setBoardBackgroundImage();
				}),	
			);
			
			cont.append(
				new PageMenu(that._app).get(that)
			);
		});
	}
	
	/**
	 * Ask the user for a new background image and set it.
	 */
	async #setBoardBackgroundImage() {
		if (!this.#current) throw new Error('No board loaded');

		try {
			var imageData = await this._app.actions.board.getBoardBackground(this.#current._id);
			
			var backImage = await this.#imageDialog.show({
				doc: this.#current,
				displayName: this.#current.name,
				imageData: imageData,
				maxWidth: Config.BOARD_BACKGROUND_MAX_WIDTH, 
				maxHeight: Config.BOARD_BACKGROUND_MAX_HEIGHT, 
				mimeType: Config.BOARD_BACKGROUND_MIME_TYPE,
				quality: Config.BOARD_BACKGROUND_QUALITY,
				maxBytes: Config.BOARD_BACKGROUND_DONT_RESCALE_BELOW_BYTES
			});
		
			await this._app.actions.board.setBoardBackgroundImage(this.#current._id, backImage)
	
			this._app.routing.call(this.#current._id);
			
		} catch(err) {
			this._app.errorHandler.handle(err);
		}
	}
}
	