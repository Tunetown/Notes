/**
 * Setlist: Shows all its children side by side
 * 
 * (C) Thomas Weber 2023 tom-vibrant@gmx.de
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
class Setlist {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!Setlist.instance) Setlist.instance = new Setlist();
		return Setlist.instance;
	}
	
	unload() {
		this.current = false;
		this.pages = null;
		this.contentSize = null;
		
		$(document).off('keydown', this.keyboardHandler);
		
		WakeLock.getInstance().release()
		.catch(function(){});
		
		PDFiumWrapper.getInstance().destroyAll();
	}

	/**
	 * Functions called by the Notes app class, mainly in updateDimensions()
	 */
	presentationModeActive() {
		return true;
	}	
	
	shouldUseFullscreen() {
		return true; //Device.getInstance().isLayoutMobile();
	}
	
	shouldShowAppElements() {
		return !!this.showAppElements;
	}
	
	getCurrentId() {
		return this.current ? this.current._id : false;
	}
	
	/**
	 * Loads the given data into the editor (which also is initialized here at first time).
	 */
	load(id) {
		var n = Notes.getInstance();
		var d = n.getData();
		var that = this;
		
		var doc = d.getById(id);
		if (!doc) throw new Error("Document " + id  + " not found");
		
		this.current = doc;

		n.setCurrentPage(this);

		// Acquire wake lock
		this.#activateWakeLock();
		
		$(document).on('keydown', this.keyboardHandler);
		
		// Build buttons
		n.setButtons([ 
			$('<div type="button" data-toggle="tooltip" title="Setlist options..." id="setlistOptionsButton" class="fa fa-ellipsis-v"" />')
			.on('click', function(e) {
				e.stopPropagation();
				
				that.#callOptions();
			}), 
		]);

		PDFiumWrapper.getInstance().initWorker()
		.then(function() {
			return that.#loadPages(that.current, true)
		})
		.then(function(pages) {
			that.pages = pages;

			var toLoad = [];
			for(var c in that.pages) {
				toLoad.push(that.pages[c].doc);
			}
			
			DocumentAccess.getInstance().loadDocuments(toLoad)
			.then(function() {
				that.#buildContent($('#contentContainer'));
				that.#update();
				that.#buildPages();
				
				n.updateDimensions();
			})
		})
		.catch(function(err) {
			n.showAlert(err.message, err.abort ? 'I' : 'E', err.messageThreadId);
		});
	}
	
	/**
	 * Keyboard events
	 */
	keyboardHandler(event) {
		var that = Setlist.getInstance();
		
		if (!that.current) return;

		// Left arrow key
		if (event.which == 37) {
			that.#previous();
		}

		// Right arrow key
		if (event.which == 39) {
			that.#next();
		}

		// Up arrow key
		if (event.which == 38) {
			that.#previous();
		}

		// Down arrow key
		if (event.which == 40) {
			that.#next();
		}

		// Page up key
		if (event.which == 33) {
			that.#previous();
		}

		// Page down key
		if (event.which == 34) {
			that.#next();
		}

		// a key
		if (event.which == 65) {
			that.#previous();
		}

		// d key
		if (event.which == 68) {
			that.#next();
		}

		// w key
		if (event.which == 87) {
			that.#previous();
		}

		// s key
		if (event.which == 83) {
			that.#next();
		}

		// Space bar
		if (event.which == 32) {
			that.#next();
		}
		
		// Pos 1 key
		if (event.which == 36) {
			that.hideOptions();
					
			that.toggleShowAppElements(false);
			that.setCurrentIndex(0);
		}

		// End key
		if (event.which == 35) {
			that.hideOptions();
					
			that.toggleShowAppElements(false);
			that.setCurrentIndex(that.pages.length - 1);
		}

		//console.log(event.which);
	}
	
	/**
	 * Triggers the activation of a wake lock. If successMsg is set, the user will
	 * be informed if the operation succeeded.
	 */
	#activateWakeLock() {
		setTimeout(function() {
			function activate(successMsg) {
				WakeLock.getInstance().lock()
				.then(function() {
					if (successMsg) {
						Notes.getInstance().showAlert('Display locked successfully.', 'S', "WakeLockMessages");
					}
				})
				.catch(function(err) {
					if (err.notSupported) {
						Notes.getInstance().showAlert('Warning: This device does not support locking the screen.<br>The device may fall asleep.', 'W', "WakeLockMessages");	
						
					} else {
						Notes.getInstance().showAlert('Error locking the screen.<br><b>Click here to retry...</b>', 'E', "WakeLockMessages", false, function() {
							// Retry manually
							activate(true);
						});
					}
				});				
			}
			
			WakeLock.getInstance().release()
			.then(activate)
			.catch(activate);
			
		}, Config.presentationModeWakeLockDelay);
	}
	
	/**
	 * Calls the setlist options
	 */
	#callOptions() {
		var n = Notes.getInstance();
		var that = this;

		n.showMenu('editorOptions', function(cont) {
			for(var p in that.pages) {
				const page = that.pages[p];
				
				cont.append(
					$('<div class="userbutton" data-index="' + p + '"/>')
					.html((parseInt(p) + 1) + ': ' + page.name)
					.on('click', function(event) {
						event.stopPropagation();
						
						that.hideOptions();
						
						const index = $(this).data('index');
						that.setCurrentIndex(index);
					}),	
				);
			}
		});
	}
	
	/**
	 * Hides all option menus for the editor
	 */
	hideOptions() {
		var n = Notes.getInstance();
		
		n.hideMenu();
		n.hideOptions();
	}
	
	/**
	 * Returns the array of pages to be shown, as promise. References are resolved, and multipage PDFs are 
	 * spread across multiple pages.
	 * 
	 * If resolveEmptyDocs is set, documents with no content will be scalled for contained documents.
	 * If there are any, the first PDF will be used. If no PDF is there, the first child with content is being used.
	 */
	#loadPages(doc, resolveEmptyDocs) {
		var n = Notes.getInstance();
		var d = n.getData();
		
		const relatedDocsOptions = {
			enableChildren: true,
			enableLinks: true,
			enableRefs: false,
			enableParents: false,
			enableBacklinks: false,
			enableSiblings: false
		};

		const children = NoteTree.getInstance().getRelatedDocuments(doc._id, relatedDocsOptions);

		var meta = [];

		/**
		 * Resolve documents: By default, only references are being resolved. If resolveEmptyDocs is set,
		 * also this is being done here.
		 */
		function resolveDocument(doc2) {
			// Resolve reference docs
			if (doc2.type == 'reference') {
				var refDoc = d.getById(doc2.ref);
				if (!refDoc) throw new Error('Document ' + doc2._id + ' has an invalid reference');
				
				doc2 = refDoc;
			}
			
			if (!resolveEmptyDocs) {
				return doc2;
			}
			
			// Check if we have to look for a contained PDF
			if ((doc2.type == 'note')) { //} && !doc2.contentSize) {
				// Scan children
				const edChildren = NoteTree.getInstance().getRelatedDocuments(doc2._id, relatedDocsOptions);
				
				// Check for an attachment first
				//var found = false; 
				for(var c in edChildren) {
					var edchild = edChildren[c];
					
					if (edchild.type == 'attachment') {
						//console.log('Resolved ' + doc2.name + ' to first attachment');

						doc2 = edchild;
						//found = true;
						
						break;
					}
				}
				
				/*if (!found) {
					// Scan for filled notes if no attachment has been found
					found = false;
					
					for(var c in edChildren) {
						var edchild = edChildren[c];
						
						if ((edchild.type == 'note') && (edchild.contentSize)) {
							//console.log('Resolved ' + doc2.name + ' to first filled child note');

							doc2 = edchild;
							found = true;

							break;
						}
					}
				}*/
			}
			
			return doc2;
		}
		
		/**
		 * Retrieve the meta entry index for the passed id.
		 */
		function retrieveMetaIndex(id) {
			for(var m in meta) {
				if (meta[m].doc._id == id) {
					return m;
				}
			}
			throw new Error('Meta index for ' + id + ' not found');
		}

		var numAttachmentDocs = 0;

		// Get all meta information (load contents/parse PDFs). Multpage PDFs are still represented with one entry here.	
		//for(var c in children) {
		async function processChild(childIndex) {
			if (childIndex >= children.length) return Promise.resolve();
			
			const startTime = Date.now();
			
			var child = resolveDocument(children[childIndex]);
			
			meta.push({
				doc: child
			});
			
			async function processNext() {
				return processChild(childIndex + 1);
			}
			
			if (child.type == 'attachment') {
				numAttachmentDocs++;
				
				return AttachmentActions.getInstance().getAttachmentUrl(child._id)
				.then(function(data) {
					if (!data.ok || !data.url) {
						return Promise.reject({
							message: data.message ? data.message : ('Error loading attachment ' + data.id)
						})
					}
					
					const mindex = retrieveMetaIndex(data.id);
					meta[mindex].url = data.url;
					
					return new Promise(function(resolve, reject) {
						if (!meta[mindex].doc.content_type || meta[mindex].doc.content_type.startsWith('text/')) {
							// Interpret as text: Load content and show in text area
							$.ajax({
								url: data.url, 
								type: "get",
								dataType: "text",
								success: function(response) {
									meta[mindex].content = response;
									
									resolve();
								},
							})
							.fail(function(response, status, error) {
								reject({
									message: 'Server error ' + response.status + ': Please see the logs.'
								})
							});
							
						} else 
						if (meta[mindex].doc.content_type && meta[mindex].doc.content_type == 'application/pdf') {
							PDFiumWrapper.getInstance().getDocument(meta[mindex].doc._id, data.blob)
							.then(function(pdf) {
								meta[mindex].pdf = pdf;
								meta[mindex].pdfSize = data.blob.size;
								
								console.log('PDFium: Loaded PDF in ' + (Date.now() - startTime) + 'ms (' + child._id + ', ' + Tools.convertFilesize(data.blob.size) + ')');
								
								resolve();
							});
						} else {
							resolve();
						}
					});
				})
				.then(processNext);
			}
			
			return processNext();
		}
		
		const startTime = Date.now();
		
		// Build pages array. This will contain separate entries for all pages of multi page PDFs
		return processChild(0)
		.then(function() {
			console.log('PDFium: -> Loaded ' + numAttachmentDocs + ' PDF documents in ' + (Date.now() - startTime) + 'ms');
			
			var pages = [];
			for(var m in meta) {
				var metaItem = meta[m];
				
				switch (metaItem.doc.type) {
					case 'note':
						pages.push({
							doc: metaItem.doc,
							name: metaItem.doc.name,
							id: metaItem.doc._id
						});
						break;
						
					case 'reference':
						pages.push({
							doc: metaItem.doc,
							name: metaItem.doc.name,
							id: metaItem.doc._id
						});
						break;
	
					case 'attachment':
						if (metaItem.content) {
							pages.push({
								doc: metaItem.doc,
								name: metaItem.doc.name,
								id: metaItem.doc._id,
								content: metaItem.content,
								url: metaItem.url
							});
														
						} else 
						if (metaItem.pdf) {
							const numPages = metaItem.pdf.numPages;
							
							if (numPages == 1) {
								pages.push({
									doc: metaItem.doc,
									pdf: metaItem.pdf,
									pdfPage: 0,
									pdfSize: metaItem.pdfSize,
									name: metaItem.doc.name,
									id: metaItem.doc._id,
									url: metaItem.url
								});
							} else {
								for(var p=0; p<numPages; ++p) {
									pages.push({
										doc: metaItem.doc,
										pdf: metaItem.pdf,
										pdfSize: metaItem.pdfSize,
										pdfPage: p,
										name: metaItem.doc.name + ' Page ' + p,
										id: metaItem.doc._id + '-page' + p,
										url: metaItem.url
									});
								}
							}
						} else {
							pages.push({
								doc: metaItem.doc,
								name: metaItem.doc.name,
								id: metaItem.doc._id,
								url: metaItem.url
							});
						}
						break;
						
					default:
						throw new Error('Invalid type: ' + child.type);
				}
			}	
			
			return Promise.resolve(pages);		
		})
	}
	
	/**
	 * Build DOM
	 */
	#buildContent(containerElement) {
		var n = Notes.getInstance();
		var d = n.getData();
		var dev = Device.getInstance();
		
		containerElement.empty();
		
		this.content = $('<div id="setlistContent"/>');
		
		this.contentSize = {
			width: containerElement.width(),
			height: containerElement.height()
		};
		
		for(var p=0; p<this.pages.length; ++p) {
			var page = this.pages[p];
			
			this.content.append(
				$('<div class="setlistItem" id="setlist-' + page.id + '"/>')
				.css('width', this.contentSize.width + 'px')
				.css('left', (p * this.contentSize.width) + 'px').append(
					$('<span class="setlistAttachmentTeaserContainer" />').append(
						$('<span class="setlistAttachmentTeaser" />')
						.text('Loading ' + page.doc.name + ', please wait')
					)
				)
			);
		}
		
		this.toggleShowAppElements(false);
		
		for(var c in this.pages) {
			var page = this.pages[c];
			
			// Replace the stubbed docs if not loaded (only done at the first access)
			if (!Document.isLoaded(page.doc)) {
				page.doc = d.getById(page.doc._id);
			}
		}

		var that = this;
		containerElement
		.append(
			$('<div id="setlistContainer" />')
			.append(
				this.content
				.css('width', this.pages.length * this.contentSize.width)
			),
			
			$('<div id="presentationModeOverlay"/>')
			.on('click', function(e) {
				e.stopPropagation();
				
				that.hideOptions();
				
				that.toggleShowAppElements(!that.shouldShowAppElements());
			})
			.on('touchstart', function(e) {
				if (!dev.isTouchAware()) return;
				
				e.stopPropagation();
				
				that.hideOptions();
				
				that.dragStartX = Tools.extractX(e);
				that.dragDeltaX = 0;
				
				that.dragStartLeft = that.content.offset().left;
				
			})
			.on('touchmove', function(e) {
				if (!dev.isTouchAware()) return;
				
				e.stopPropagation();
				
				if (!that.dragStartX) return;
				that.dragDeltaX = Tools.extractX(e) - that.dragStartX;
				
				that.content.css('left', that.dragStartLeft + that.dragDeltaX);
			})
			.on('touchend', function(e) {
				if (!dev.isTouchAware()) return;
				
				e.stopPropagation();
				
				if (!that.dragDeltaX) {
					that.#update();
					return;
				}
				
				if (that.dragDeltaX < 60) {  // TODO Const
					that.toggleShowAppElements(false);
					that.selectNext();
				} 
				if (that.dragDeltaX > 60) {  // TODO Const
					that.toggleShowAppElements(false);
					that.selectPrevious();
				}
				that.#update();
			})
			.append(
				// Info texts
				$('<div id="presentationModeInfoLeft" />'),
				$('<div id="presentationModeInfoMiddle" />')
				.on('click', function(e) {
					if (!dev.isTouchAware()) return;
					
					e.stopPropagation();
					
					that.hideOptions();

					var tree = NoteTree.getInstance();
					var id = that.current._id;
					tree.highlightDocument(id);
				}),
				$('<div id="presentationModeInfoRight" />'),

				// Click overlays for L/R
				$('<div id="presentationModeOverlayLeft" data-toggle="tooltip" title="Go to previous Document"/>')
				.on('click', function(e) {
					e.stopPropagation();
					
					that.#previous();
				}),
				$('<div id="presentationModeOverlayRight" data-toggle="tooltip" title="Go to next Document"/>')
				.on('click', function(e) {
					e.stopPropagation();

					that.#next();
				}),
			),
		);
	}
	
	#previous() {
		this.hideOptions();
					
		this.toggleShowAppElements(false);
		this.selectPrevious();
	}
	
	#next() {
		this.hideOptions();
					
		this.toggleShowAppElements(false);
		this.selectNext();
	}
	
	/**
	 * Create note content
	 */
	async #createNote(page, index) {
		if (!Document.isLoaded(page.doc)) {
			throw new Error('Document ' + page.doc.name + ' is not loaded');
		}
		
		var el = $('#setlist-' + page.id);
		if (!el) {
			throw new Error('Page element not found for page ' + index);
		}

		const content = page.doc.content ? page.doc.content : page.doc.name;

		if (page.doc.editor && (page.doc.editor == 'code')) {
			return new Promise(function(resolve, reject) {
				setTimeout(function() {
					el.empty();
					
					CodeMirror(el[0], { //$('#setlist-' + page.id)[0], {
						value: content,
						mode: (page.doc.editorParams && page.doc.editorParams.language) ? page.doc.editorParams.language : 'markdown',
						readOnly: true
					}, 0);
					
					resolve();	
				})
			});
		} else {
			el
			.empty()
			.append(
				$('<div class="mce-content-body" contenteditable="false" style="margin: 10px"/>')
				.html(content)
			);
			
			return Promise.resolve();
		}
	}
	
	/**
	 * Create attachment content
	 */
	async #createAttachment(page, index) {
		var el = $('#setlist-' + page.id);
		if (!el) {
			throw new Error('Page element not found for page ' + index);
		}
		
		var that = this;
		if (!page.doc.content_type || page.doc.content_type.startsWith('text/')) {
			el
			.empty()
			.append(
				$('<textarea readonly class="preview textpreview">' + page.content + '</textarea>')
			);
			
			return Promise.resolve();
				
		} else 
		if (page.doc.content_type && page.doc.content_type == 'application/pdf') {
			var canvasJ = $('<canvas class="setlistPdfCanvas"/>');
			var canvas = canvasJ[0];

			el.css('text-align', 'center');
			
			var pdfpage = page.pdf.getPage(page.pdfPage);
			const dimensions = pdfpage.getDimensions();
			const ratio = dimensions.width / dimensions.height;
			const screenRatio = that.contentSize.width / that.contentSize.height;

			var w, h;
			if (ratio > screenRatio) {
				w = that.contentSize.width;
				h = w / ratio;
			} else {
				h = that.contentSize.height;				
				w = h * ratio;
			}

			return pdfpage.render(canvas, Math.floor(w), Math.floor(h))
			.then(function() {
				el
				.empty()
				.append(canvasJ);
			});
						
		} else {
			// Try object tag to embed the content (for other document types...)
			el
			.empty()
			.append(
				$('<object class="preview" data="' + page.url + '" type="' + page.doc.content_type + '" ><span id="previewteaser">Preview not available</span></object>')
				.css('width', '100%')
				.css('height', '100%')
				.css('object-fit', 'contain')
			);
			
			return Promise.resolve();
		}
	}
	
	/**
	 * Returns the current page index
	 */
	getCurrentIndex() {
		const id = this.current._id;
		const vs = ClientState.getInstance().getViewSettings();
		
		if (vs.presentationModeIndex) {
			for(var i in vs.presentationModeIndex) {
				const index = vs.presentationModeIndex[i];
				if ((index.id == id) && (index.hasOwnProperty('index'))) {
					return index.index;
				}
			}
		}
		
		return 0; 
	}
	
	/**
	 * Set the current page index
	 */
	setCurrentIndex(index) {
		const id = this.current._id;
		var vs = ClientState.getInstance().getViewSettings();

		if (!vs.presentationModeIndex) {
			vs.presentationModeIndex = [];
		}
			
		var found = false;
		for(var i in vs.presentationModeIndex) {
			var indexItem = vs.presentationModeIndex[i];
			if (indexItem.id == id) {
				indexItem.index = index;
				found = true;
				break;
			}
		}
		if (!found) {
			vs.presentationModeIndex.push({
				id: id,
				index: index
			});
		}

		ClientState.getInstance().saveViewSettings(vs);

		this.#update();
	}
	
	/**
	 * Toggles if the app elements shall be shown
	 */
	toggleShowAppElements(show) {
		this.showAppElements = show;
		
		var n = Notes.getInstance();
		
		if (!show) {
			n.toggleShowNavigation(false);
		} else {			
			n.updateDimensions();
		}
		
	}
	
	/**
	 * Select the previous page
	 */
	selectPrevious() {
		const curr = this.getCurrentIndex();
		if (curr > 0) {
			this.setCurrentIndex(curr - 1);
		}
	}
	
	/**
	 * Select the next page
	 */
	selectNext() {
		const curr = this.getCurrentIndex();
		if (curr < this.pages.length - 1) {
			this.setCurrentIndex(curr + 1);
		}	
	}
	
	/**
	 * Update UI state of the setlist after changes
	 */
	#update() {
		this.#updateInfoOverlays();
		this.#updateClickOverlays();
		//this.#createMissingPages();
		
		Notes.getInstance().setStatusText('Setlist: ' + this.current.name + ' - ' + this.pages[this.getCurrentIndex()].name + ' (' + (this.getCurrentIndex() + 1) + ' of ' + this.pages.length + ')');

		this.content.animate({
			left: (- this.getCurrentIndex() * this.contentSize.width) + 'px'
		}, {
			duration: 100
		});
	}
	
	/**
	 * Udate click overlay properties
	 */
	#updateClickOverlays() {	
		if (!Device.getInstance().isLayoutMobile() && (Device.getInstance().getOrientation() != Device.ORIENTATION_PORTRAIT)) {
			const leftEl = $('#presentationModeOverlayLeft');
			const rightEl = $('#presentationModeOverlayRight');

			leftEl.css('width', '50%');
			leftEl.css('height', '100%');
			rightEl.css('width', '50%');
			rightEl.css('height', '100%');
		}
	}
		
	/**
	 * Udate info overlay properties and contents
	 */
	#updateInfoOverlays() {
		const neighborInfo = this.#getNeighborInfo(this.getCurrentIndex());
		
		const leftEl = $('#presentationModeInfoLeft');
		const midEl = $('#presentationModeInfoMiddle');
		const rightEl = $('#presentationModeInfoRight');

		// Left info panel
		leftEl.empty();
		if (neighborInfo.pageBefore) {
			leftEl.html('(' + neighborInfo.numPagesBefore + ') <b>< ' + neighborInfo.pageBefore.name + '</b>');		
		}
		
		// Middle info panel
		midEl.empty();
		midEl.html(this.current.name);
		
		// Right info panel
		rightEl.empty();
		if (neighborInfo.pageAfter) {
			rightEl.html('<b>' + neighborInfo.pageAfter.name + ' ></b> (' + neighborInfo.numPagesAfter + ') ');	
		}		
		
		// Sizes
		leftEl.css('height', '30px'); // TODO
		midEl.css('height', '30px'); // TODO
		rightEl.css('height', '30px'); // TODO
	}
	
	/**
	 * Starting from the current index, this loads all further pages asynchronously.
	 */
	#buildPages() {
		this.buildPagesStartTime = Date.now();
		this.numRenderedpages = 0;
		//this.numRenderingTasks = 0;

		this.#buildPagesRec(this.#getNextRenderIndex());
	}
		
	#buildPagesRec(index) {
		var that = this;

		// First render the current page
		setTimeout(function() {
			if (!that.current) return;

			//that.numRenderingTasks++;
			//console.log(' -> +Tasks: ' + that.numRenderingTasks);

			that.#renderPage(index)
			.then(function() {
				if (!that.current) return Promise.reject();

				//that.numRenderingTasks--;
				//console.log(' -> -Tasks: ' + that.numRenderingTasks);
				
				// See which pages beneath the current one need to be rendered
				var cindex = that.#getNextRenderIndex();
				
				if (cindex >= 0) {
					that.#buildPagesRec(cindex);
				} else {
					console.log("PDFium: Finished rendering of " + that.numRenderedpages + " pages, took " + (Date.now() - that.buildPagesStartTime) + 'ms');
				}
			});
		}, 1);
	}
	
	/**
	 * Returns the next page index to be rendered
	 */
	#getNextRenderIndex() {
		var index = this.getCurrentIndex();
		
		// Is the current page rendered?
		var page = this.pages[index];
		if (!page.isRendered) return index;
		
		// Get the nearest page that has not been rendered already (upwards first)
		var nextUp = index + 1;
		while ((nextUp < this.pages.length) && this.pages[nextUp].isRendered) {
			++nextUp;
		} 
		
		var nextDn = index - 1;
		while ((nextDn >= 0) && this.pages[nextDn].isRendered) {
			--nextDn;
		} 
		
		if ((nextUp < this.pages.length) && (nextDn >= 0)) {
			const distUp = nextUp - index;
			const distDn = index - nextDn;
			
			if (distUp <= distDn) {
				return nextUp;
			} else {
				return nextDn;
			}
		} else
		if (nextUp < this.pages.length) {
			// Only up is available
			return nextUp;
		} else
		if (nextDn >= 0) {
			// Only down is available
			return nextDn;
		}
		
		// All rendered
		return -1;
	}
	
	/**
	 * Renders a page DOM.
	 */
	async #renderPage(index) {
		if (!this.current) return Promise.reject();
		var that = this;
		
		const startTime = Date.now();
		
		if (index < 0) throw new Error('Invalid index: ' + index);
		if (index > this.pages.length-1) throw new Error('Invalid index: ' + index);
		
		var page = this.pages[index];
		if (page.isRendered) return Promise.resolve();

		//console.log("Rendering page " + index);
		switch (page.doc.type) {
			case 'note':
				return this.#createNote(page, index)
				.then(function() {
					page.isRendered = true;
					
					//console.log("Page " + index + " rendered in " + (Date.now() - startTime) + 'ms (Note)');
				});
				
			case 'reference':
				throw new Error(page.doc._id + ': References must be resolved in #loadPages()');

			case 'attachment':
				return this.#createAttachment(page, index)
				.then(function() {
					page.isRendered = true;
					that.numRenderedpages++;
					
					console.log("PDFium: Page " + index + " rendered in " + (Date.now() - startTime) + 'ms (' + page.id + ', ' + Tools.convertFilesize(page.pdfSize) + ')');
				});
				
			default:
				throw new Error('Could not resolve child type: ' + page.doc.type);
		}
	}
	
	/**
	 * Info about the neighbors of the passed index.
	 */
	#getNeighborInfo(index) {
		const currentPage = this.pages[index];
		if (!currentPage) throw new Error('Page at index ' + index + ' not found');
		
		var ret = {
			numPagesBefore: 0,
			numPagesAfter: 0,
			pageBefore: null,
			pageAfter: null
		};
		
		var before = true;
		for(var c in this.pages) {
			const page = this.pages[c];
			
			if (page.id == currentPage.id) {
				before = false;
				
				if (c > 0) {
					ret.pageBefore = this.pages[parseInt(c)-1];
				}				
				if (c < this.pages.length - 1) {
					ret.pageAfter = this.pages[parseInt(c)+1];
				}				
			} else {
				if (before) {
					ret.numPagesBefore++;
				} else {
					ret.numPagesAfter++;
				}		
			}
		}
		
		return ret;
	}
}
	