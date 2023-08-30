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
	
	presentationModeActive() {
		return true;
	}	
	
	shouldUseFullscreen() {
		return Notes.getInstance().isMobile();
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
		var doc = d.getById(id);
		if (!doc) throw new Error("Document " + id  + " not found");
		
		this.current = doc;
		this.currentIndex = 0;
		
		this.children = NoteTree.getInstance().getRelatedDocuments(id, {
			enableChildren: true,
			enableRefs: true,
			enableLinks: true,
			enableParents: false,
			enableBacklinks: false,
			enableSiblings: false
		});

		n.setStatusText('Setlist: ' + doc.name + ' (' + (this.currentIndex+1) + ' of ' + this.children.length + ' items)');

		n.setCurrentPage(this);

		this.contentIndex = 0;
		
		this.#buildContent($('#contentContainer'));
		this.#update();
		
		n.updateDimensions();
	}
	
	#buildContent(containerElement) {
		var n = Notes.getInstance();
		var d = n.getData();
		
		containerElement.empty();
		
		this.content = $('<div id="setlistContent"/>');
		
		this.contentSize = {
			width: containerElement.width(),
			height: containerElement.height()
		};
		
		this.toggleShowAppElements(false);
		
		var index = 0;
		for(var c in this.children) {
			var child = this.children[c];
			
			var el = null;
			switch (child.type) {
				case 'note':
					el = this.#createNote(child, index);
					break;
					
				case 'reference':
					var ref = d.getById(child.ref);
					if (!ref) throw new Error("Invaild reference in " + child._id + ": " + child.ref);
					
					el = this.#createNote(ref, index);
					break;

				case 'attachment':
					el = this.#createAttachment(child, index);
					break;
			}
			
			++index;
			
			if (!el) throw new Error('Could not resolve child type: ' + child.type);
			
			this.content.append(el);
		}

		var that = this;
		containerElement
		.append(
			$('<div id="setlistContainer" />')
			.append(
				this.content
				.css('width', this.children.length * this.contentSize.width)
			),
			
			$('<div id="presentationModeOverlay"/>')
			.on('click', function(e) {
				e.stopPropagation();
				
				that.toggleShowAppElements(!that.shouldShowAppElements());
			})
			.on('touchstart', function(e) {
				if (!n.isMobile()) return;
				e.stopPropagation();
				
				that.dragStartX = Tools.extractX(e);
				that.dragDeltaX = 0;
				
				that.dragStartLeft = that.content.offset().left;
				
			})
			.on('touchmove', function(e) {
				if (!n.isMobile()) return;
				e.stopPropagation();
				
				if (!that.dragStartX) return;
				that.dragDeltaX = Tools.extractX(e) - that.dragStartX;
				
				that.content.css('left', that.dragStartLeft + that.dragDeltaX);
			})
			.on('touchend', function(e) {
				if (!n.isMobile()) return;
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
					if (!n.isMobile()) return;
					
					e.stopPropagation();

					var tree = NoteTree.getInstance();
					var id = that.current._id;
					tree.highlightDocument(id);
				}),
				$('<div id="presentationModeInfoRight" />'),

				// Click overlays for L/R
				$('<div id="presentationModeOverlayLeft" data-toggle="tooltip" title="Go to previous Document"/>')
				.on('click', function(e) {
					//if (n.isMobile()) return;
					e.stopPropagation();
					
					that.toggleShowAppElements(false);
					that.selectPrevious();
				}),
				$('<div id="presentationModeOverlayRight" data-toggle="tooltip" title="Go to next Document"/>')
				.on('click', function(e) {
					//if (n.isMobile()) return;
					e.stopPropagation();
					
					that.toggleShowAppElements(false);
					that.selectNext();
				}),
			),
		);
	}
	
	toggleShowAppElements(show) {
		this.showAppElements = show;
		
		Notes.getInstance().updateDimensions();
	}
	
	selectPrevious() {
		if (this.currentIndex > 0) {
			this.currentIndex--;
			this.#update();
		}
	}
	
	selectNext() {
		if (this.currentIndex < this.children.length-1) {
			this.currentIndex++;
			this.#update();
		}	
	}
	
	#update() {
		this.#updateInfoOverlays();
		this.#updateClickOverlays();
		
		this.content.animate({
			left: (- this.currentIndex * this.contentSize.width) + 'px'
		}, {
			duration: 100
		});
	}
	
	#updateClickOverlays() {	
		if (!Notes.getInstance().isMobile()) {
			const leftEl = $('#presentationModeOverlayLeft');
			const rightEl = $('#presentationModeOverlayRight');

			leftEl.css('width', '50%');
			leftEl.css('height', '100%');
			rightEl.css('width', '50%');
			rightEl.css('height', '100%');
		}
	}
		
	#updateInfoOverlays() {
		const neighborInfo = this.#getNeighborInfo(this.currentIndex);
		
		const leftEl = $('#presentationModeInfoLeft');
		const midEl = $('#presentationModeInfoMiddle');
		const rightEl = $('#presentationModeInfoRight');

		// Left info panel
		leftEl.empty();
		if (neighborInfo.documentBefore) {
			leftEl.html('(' + neighborInfo.numDocumentsBefore + ') <b>< ' + neighborInfo.documentBefore.name + '</b>');		
		}
		
		// Middle info panel
		midEl.empty();
		midEl.html(this.current.name);
		
		// Right info panel
		rightEl.empty();
		if (neighborInfo.documentAfter) {
			rightEl.html('<b>' + neighborInfo.documentAfter.name + ' ></b> (' + neighborInfo.numDocumentsAfter + ') ');	
		}		
		
		// Sizes
		leftEl.css('height', '30px'); // TODO
		midEl.css('height', '30px'); // TODO
		rightEl.css('height', '30px'); // TODO
	}
	
	/**
	 * Info about the neighbors of the passed index.
	 */
	#getNeighborInfo(index) {
		const doc = this.children[index];
		if (!doc) throw new Error('Document ' + id + ' not found');
		
		var ret = {
			numDocuments: this.children.length,
			numDocumentsBefore: 0,
			numDocumentsAfter: 0,
			documentBefore: null,
			documentAfter: null
		};
		
		var before = true;
		for(var c in this.children) {
			const child = this.children[c];
			
			if (child._id == doc._id) {
				before = false;
				
				if (c > 0) {
					ret.documentBefore = this.children[parseInt(c)-1];
				}				
				if (c < this.children.length - 1) {
					ret.documentAfter = this.children[parseInt(c)+1];
				}				
			} else {
				if (before) {
					ret.numDocumentsBefore++;
				} else {
					ret.numDocumentsAfter++;
				}		
			}
		}
		
		return ret;
	}
	
	
	#createNote(doc, index) {
		return $('<div class="setlistItem" />')
		.css('background-color', Tools.getRandomColor())
		.css('border', '10px solid ' + Tools.getRandomColor())
		.css('width', this.contentSize.width + 'px')
		.css('left', (index * this.contentSize.width) + 'px')
		.html('<h1>' + index + '</h1>' + doc.name);
	}
	
	#createAttachment(doc, index) {
		return $('<div class="setlistItem" />')
		.css('background-color', Tools.getRandomColor())
		.css('border', '10px solid ' + Tools.getRandomColor())
		.css('width', this.contentSize.width + 'px')
		.css('left', (index * this.contentSize.width) + 'px')
		.html('<h1>' + index + '</h1>' + doc.name);
	}
	
}
	