/**
 * Document class. Currently this just has some static stuff defining the doc types.
 * TODO: Use as data model class.
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
class Document {

	static app = null;

	static setApp(app) {
		Document.app = app;
	}
	
	/**
	 * Updates document metadata. Has to be called whenever the content or attachments 
	 * have been changed.
	 */
	static updateMeta(doc) {
		if (!Document.isLoaded(doc)) throw new Error('Only loaded docs can be updated');
		
		// Content size
		doc.contentSize = doc.content ? doc.content.length : 0;
		
		// Attachment size
		doc.attachmentSize = 0;
		for(var name in doc._attachments || []) {
			if (!doc._attachments.hasOwnProperty(name)) continue;
			
			var att = doc._attachments[name];
			if (!att) continue;
			
			if (att.hasOwnProperty('data') && (typeof(att.data) == 'string')) {
				doc.attachmentSize += att.data.length;
			} else if (att.hasOwnProperty('length')) {
				doc.attachmentSize += att.length;				
			} else {
				console.log('ERROR: Cannot determine attachment size for ' + doc._id + ' - ' + att.name);
				break;
			}			
		}
		
		// Change log size
		doc.changeLogSize = 0;
		if (doc.changeLog) {
			doc.changeLogSize = JSON.stringify(doc.changeLog).length;
		}
		
		// Background image size
		doc.backImageSize = 0;
		if (doc.backImage) {
			doc.backImageSize = JSON.stringify(doc.backImage).length;
		}
		
		// Content preview
		if (doc.type != 'attachment') {
			doc.preview = Document.createPreview(doc, 1000);
		}
		
		// Links and Tags
		if (doc.type == 'note') {
			doc.links = Document.getLinksFromContent(doc);
			doc.tags = Document.getTagsFromContent(doc);
		}
		
		// Clear navigation DOM element buffer
		delete doc.navItemElement;
	}
	
	/**
	 * Check basic property correctness. Optionally pass allDocs to get deeper tests.
	 */
	static checkBasicProps(doc, errors, allDocs) {
		if (!Document.isLoaded(doc)) {
			errors.push({
				message: 'Document has stub flag set',
				id: doc._id,
				type: 'E',
				solverReceipt: [{
					action: 'deleteProperty',
					propertyName: 'stub'
				}]
			});		
		}
		
		if (!doc.type) {
			errors.push({
				message: 'Document type missing',
				id: doc._id,
				type: 'E',
				solverReceipt: [{
					action: 'setProperty',
					propertyName: 'type',
					propertyValue: 'note'
				}]
			});
		}
		
		if (!Document.isTypeValid(doc.type)) {
			errors.push({
				message: 'Document type invalid: ' + doc.type,
				id: doc._id,
				type: 'E',
				solverReceipt: [{
					action: 'setProperty',
					propertyName: 'type',
					propertyValue: 'note'
				}]
			});
		}
		
		if (!doc.hasOwnProperty('parent')) {
			errors.push({
				message: 'Parent missing',
				id: doc._id,
				type: 'E',
				solverReceipt: [{
					action: 'setProperty',
					propertyName: 'parent',
					propertyValue: ''
				}]
			});		
		}
		
		if (doc.parent == doc._id) {
			errors.push({
				message: 'Self-referencing parent: ' + doc.parent,
				id: doc._id,
				type: 'E',
				solverReceipt: [{
					action: 'setProperty',
					propertyName: 'parent',
					propertyValue: ''
				}]
			});		
		}
		
		if (!doc.name) {
			errors.push({
				message: 'Name missing',
				id: doc._id,
				type: 'E',
				solverReceipt: [{
					action: 'setProperty',
					propertyName: 'name',
					propertyValue: doc._id
				}]
			});		
		}
		
		if (!doc.timestamp) {
			errors.push({
				message: 'Timestamp missing',
				id: doc._id,
				type: 'E',
				solverReceipt: [{
					action: 'setProperty',
					propertyName: 'timestamp',
					propertyValue: Date.now()
				}]
			});		
		}
		
		// Check reference stuff
		if (doc.type == "reference") {
			if (!doc.ref) {
				errors.push({
					message: 'Reference missing',
					id: doc._id,
					type: 'E'
				});		
			}
			
			if (doc.ref == doc._id) {
				errors.push({
					message: 'Self-referencing reference',
					id: doc._id,
					type: 'E'
				});		
			}
		}
		
		// Check editor mode etc.
		if (doc.type == "note") {
			if (!doc.editor) {
				errors.push({
					message: 'Editor mode missing',
					id: doc._id,
					type: 'E',
					solverReceipt: [{
						action: 'setProperty',
						propertyName: 'editor',
						propertyValue: Document.app.settings.settings.defaultNoteEditor
					}]
				});		
			} else 
			if (!Document.isValidEditorMode(doc.editor)) {
				errors.push({
					message: 'Invalid editor mode: ' + doc.editor,
					id: doc._id,
					type: 'E',
					solverReceipt: [{
						action: 'setProperty',
						propertyName: 'editor',
						propertyValue: Document.app.settings.settings.defaultNoteEditor
					}]
				});		
			}
		}

		// TODO solve otherwise
		AttachmentPage.checkBasicProps(doc, errors);
		CodeEditor.checkBasicProps(doc, errors);
		BoardEditor.checkBasicProps(doc, errors);
		
		// Check label definitions and labels.
		LabelDefinitionsPage.check(doc, errors, allDocs);
	}
	
	/**
	 * Repairs the passed document following the passed receipt.
	 */
	static repairBasicData(doc, receipts, solver) {
		// Solving by solver function
		if (solver) {
			solver(doc);
		}
		
		// Solving by receipt
		for(var r in receipts || []) {
			var receipt = receipts[r];
			
			switch(receipt.action) {
			case 'deleteProperty':
				if (!receipt.propertyName) throw new Error('Cannot repair: Property name missing for ' + receipt.action + ' action in ' + doc._id);
				delete doc[receipt.propertyName];
				console.log('   -> Deleted property ' + receipt.propertyName);
				break;
				
			case 'setProperty':
				if (!receipt.propertyName) throw new Error('Cannot repair: Property name missing for ' + receipt.action + ' action in ' + doc._id);
				doc[receipt.propertyName] = receipt.propertyValue;
				console.log('   -> Set property ' + receipt.propertyName + ' to new value ' + receipt.propertyValue);
				break;
				
			default:
				throw new Error('Invalid repair action: ' + receipt.action);
			}
		}
	}
	
	/**
	 * Check meta correctness
	 */
	static checkMeta(doc, errors) {
		if (!Document.isLoaded(doc)) {
			errors.push({
				message: 'Document has stub flag set',
				id: doc._id,
				type: 'E'
			});		
		}
		
		// Check if it is a valid document
		if (!doc.type) {
			errors.push({
				message: 'Type missing',
				id: doc._id,
				type: 'E'
			});		
			return;
		}
		
		// Meta data
		var cl = Document.clone(doc);
		Document.updateMeta(cl);
		
		if (doc.backImage) {
			// Back image data, if existent
			if (doc.backImage.stub) {
				errors.push({
					message: 'Background image stub flag is set',
					id: doc._id,
					type: 'E',
				});		
			}

			if (!doc.backImage.ref && !doc.backImage.data) {
				errors.push({
					message: 'No background image data found',
					id: doc._id,
					type: 'E',
				});		
			}
			
			if (!doc.backImage.size) {
				errors.push({
					message: 'No background image size descriptor found',
					id: doc._id,
					type: 'E',
				});		
			} else {
				if (!doc.backImage.size.width || !doc.backImage.size.height) {
					errors.push({
						message: 'Incomplete background image size descriptor',
						id: doc._id,
						type: 'E',
					});		
				}
			}
			
			if (!doc.hasOwnProperty('backImageSize')) {
				errors.push({
					message: 'Background image size missing',
					id: doc._id,
					type: 'W',
				});		
			} else if (cl.backImageSize != doc.backImageSize) {
				errors.push({
					message: 'Invalid background image size: is ' + doc.backImageSize + ' should be ' + cl.backImageSize,
					id: doc._id,
					type: 'E',
				});
			} else {
				if (doc.backImageSize > Config.ITEM_BACKGROUND_DONT_RESCALE_BELOW_BYTES) {
					errors.push({
						message: 'Background image very large: ' + Tools.convertFilesize(doc.backImageSize),
						id: doc._id,
						type: 'W',
					});
				}	
			}
		}
		
		if (!doc.hasOwnProperty('attachmentSize')) {
			errors.push({
				message: 'Attachments size missing',
				id: doc._id,
				type: 'W',
			});		
		} else 
		if (cl.attachmentSize != doc.attachmentSize) {
			errors.push({
				message: 'Invalid attachments size: is ' + doc.attachmentSize + ' should be ' + cl.attachmentSize,
				id: doc._id,
				type: 'E',
			});		
		}
		
		if (doc.type != "attachment") {
			if (!doc.hasOwnProperty('contentSize')) {
				errors.push({
					message: 'Content size missing',
					id: doc._id,
					type: 'W'
				});		
			} else 
			if (cl.contentSize != doc.contentSize) {
				errors.push({
					message: 'Invalid content size: is ' + doc.contentSize + ' should be ' + cl.contentSize,
					id: doc._id,
					type: 'E'
				});		
			}
		
			if (!doc.hasOwnProperty('changeLogSize')) {
				errors.push({
					message: 'ChangeLog size missing',
					id: doc._id,
					type: 'W'
				});		
			} else 
			if (cl.changeLogSize != doc.changeLogSize) {
				errors.push({
					message: 'Invalid changeLog size: is ' + doc.changeLogSize + ' should be ' + cl.changeLogSize,
					id: doc._id,
					type: 'E'
				});		
			}

			if (!doc.hasOwnProperty('preview')) {
				errors.push({
					message: 'Preview missing',
					id: doc._id,
					type: 'W'
				});		
			} else 
			if (cl.preview != doc.preview) {
				errors.push({
					message: 'Invalid preview',
					id: doc._id,
					type: 'E'
				});		
			}
		}
		
		Document.checkLinkages(doc, cl, errors);
		Document.checkTags(doc, cl, errors);
	}
	
	static checkLinkages(doc, cl, errors, ignoreBrokenLinksInContent) {
		var d = Document.app.data;
		
		if (!cl) {
			cl = Document.clone(doc);
			Document.updateMeta(cl);
		}
		
		// Linkages
		if (doc.type == 'note') {
			if (cl.hasOwnProperty('links')) {
				if ((!doc.hasOwnProperty('links')) || (!doc.links)) {
					if (cl.links.length > 0) {
						errors.push({
							message: 'Links buffer does not exist',
							id: doc._id,
							type: 'E'
						});
					}
				} else {
					if (cl.links.length != doc.links.length) {
						errors.push({
							message: 'Links buffer size mismatch: Should have ' + cl.links.length + ' entries, but has ' + doc.links.length,
							id: doc._id,
							type: 'E'
						});
					} else {
						// Compare links
						for(var c=0; c<cl.links.length; ++c) {
							var found = false;
							for(var dd=0; dd<doc.links.length; ++dd) {
								if (doc.links[dd] == cl.links[c]) {
									found = true;
									break;
								}
							}
							
							if (!found) {
								errors.push({
									message: 'Link buffer invalid: Link ' + cl.links[c] + ' not found',
									id: doc._id,
									type: 'E'
								});
							}
							
							// Check if the links are broken
							if (!ignoreBrokenLinksInContent) {
								var link = doc.links[c];
								if (d && (!d.getById(link))) {
									errors.push({
										message: 'Broken link (target document does not exist): ' + link,
										id: doc._id,
										brokenLink: link,
										type: 'W'
									});
								}
							}
						}
					}
				}
			}
		}
	}
	
	static checkTags(doc, cl, errors) {
		if (!cl) {
			cl = Document.clone(doc);
			Document.updateMeta(cl);
		}
		
		// Linkages
		if (doc.type == 'note') {
			if (cl.hasOwnProperty('tags')) {
				if ((!doc.hasOwnProperty('tags')) || (!doc.tags)) {
					if (cl.tags.length > 0) {
						errors.push({
							message: 'Tags buffer does not exist',
							id: doc._id,
							type: 'E'
						});
					}
				} else {
					if (cl.tags.length != doc.tags.length) {
						errors.push({
							message: 'Tags buffer size mismatch: Should have ' + cl.tags.length + ' entries, but has ' + doc.tags.length,
							id: doc._id,
							type: 'E'
						});
					} else {
						// Compare tags
						for(var c=0; c<cl.tags.length; ++c) {
							var found = false;
							for(var dd=0; dd<doc.tags.length; ++dd) {
								if (doc.tags[dd] == cl.tags[c]) {
									found = true;
									break;
								}
							}
							
							if (!found) {
								errors.push({
									message: 'Tag buffer invalid: Tag ' + cl.tags[c] + ' not found',
									id: doc._id,
									type: 'E'
								});
							}
						}
					}
				}
			}
		}
	}
	
	/**
	 * Check the documents link buffer and warn the user if anything is wrong.
	 */
	static invalidMetaWarning(doc) {
		// Sanity check
		setTimeout(function() {
			var errors = [];
			
			// Just check if the links buffers are up to date
			Document.checkLinkages(doc, null, errors, true);
			Document.checkTags(doc, null, errors);
			
			if (errors.length > 0) {
				Document.app.showAlert(
					'Broken metadata (' + errors.length + ' errors) in document ' + doc.name + ' (' + doc._id + '), please re-save it or repair in Settings.', 
					'E', 
					'brokenMetaMessages'
				);
			}
		}, 500);
	}
	
	/**
	 * Check the documents link buffer and warn the user if anything is wrong.
	 */
	static brokenLinksWarning(doc) {
		Document.invalidMetaWarning(doc);
	}
	
	/**
	 * Gets the target document for a reference, else just returns the document.
	 */
	static getTargetDoc(doc) {
		if (!doc) return null;
		if (doc.type != 'reference') return doc;

		return Document.getTargetDoc(Document.app.data.getById(doc.ref));
	}
	
	/**
	 * Returns the documents content as string.
	 */
	static getContent(doc) {
		if (!Document.isLoaded(doc)) throw new Error('Document ' + doc._id + ' is not loaded');
		return doc.content;
	}
	
	/**
	 * Returns the document's attachments or null if none are existent.
	 */
	static getAttachments(doc) {
		if (!Document.isLoaded(doc)) throw new Error('Document ' + doc._id + ' is not loaded');
		return doc._attachments;
	}
	
	static getChangeLog(doc) {
		if (!Document.isLoaded(doc)) throw new Error('Document ' + doc._id + ' is not loaded');
		return doc.changeLog;
	}
	
	/**
	 * Checks if the document is fully loaded.
	 */
	static isLoaded(doc) {
		return !doc.stub;
	}
	
	/**
	 * Removes the stub flag from the document.
	 */
	static setLoaded(doc) {
		delete doc.stub;
	}
	
	/**
	 * Sets the stub flag on the document.
	 */
	static setStub(doc) {
		doc.stub = true;
	} 
	
	/**
	 * Returns a link to the document as string with [[]] syntax.
	 */
	static composeLinkToDoc(doc) {
		if (!doc) return '';
		return Linkage.composeLink(doc._id, doc.name ? doc.name : null);
	}
	
	/**
	 * Returns the links array from the given documents content
	 */
	static getLinksFromContent(doc) {
		if (!doc) return [];
		if (!doc.content) return [];
	
		const links = Linkage.parse(doc.content);
	
		var ret = [];
		for(var i=0; i<links.length; ++i) {
			const meta = Linkage.splitLink(links[i].link);
			
			if (!meta) continue;
			if (!meta.target) continue;
			
			ret.push(meta.target);	
		}
		return ret;
	}
	
	/**
	 * Returns the tags array from the given documents content
	 */
	static getTagsFromContent(doc) {
		if (!doc) return [];
		if (!doc.content) return [];
	
		const tags = Document.app.hashtag.parse(doc.content);
	
		var ret = [];
		for(var i=0; i<tags.length; ++i) {
			ret.push(tags[i].tag);	
		}
		return ret;
	}

	/**
	 * Sets a lock for the given ID (scope is the instance). If the document is locked,
	 * it waits until the lock is free again.
	 */
	static lock(id) {
		if (!id) throw new Error('No ID passed to lock');
		
		var doc = Document.app.data.getById(id);
		if (!doc) throw new Error('Document ' + id + ' not found');
		
		if (doc.lock) {
			throw new Error('The document ' + (doc ? doc.name : id) + ' is already locked by ' + doc.lock);
		} else {
			doc.lock = Document.app.db.getLoggedInUser();
		}
	}
	
	/**
	 * Releases the lock of ID. Returns if the lock has been set.
	 */
	static unlock(id) {
		if (!id) throw new Error('No ID passed to lock');
		
		var doc = Document.app.data.getById(id);
		if (!doc) throw new Error('Document ' + id + ' not found');
		
		delete doc.lock;
	}
	
	/**
	 * Takes over all content from src to doc.
	 */
	static update(doc, src) {
		doc._rev = src._rev;
		doc.name = src.name;
		doc.type = src.type;
		doc.order = src.order;
		doc.ref = src.ref;
		doc.backColor = src.backColor;
		doc.backImage = src.backImage;
		doc.color = src.color;
		doc.content = src.content;
		doc.timestamp = src.timestamp;
		doc.labelDefinitions = src.labelDefinitions;
		doc.labels = src.labels;
		doc._attachments = src._attachments;
		doc._conflicts = src._conflicts;
		doc.content_type = src.content_type;
		doc.attachment_filename = src.attachment_filename;
		doc.changeLog = src.changeLog;
		doc.stub = src.stub;

		doc.deleted = src.deleted;
		
		doc.editor = src.editor;
		doc.editorParams = src.editorParams;
		
		doc.links = src.links;
		doc.tags = src.tags;
		doc.navRelations = src.navRelations;
		
		doc.star = src.star;
		
		doc.boardState = src.boardState;
		
		doc.attachmentSize = src.attachmentSize;
		doc.contentSize = src.contentSize;
		doc.changeLogSize = src.changeLogSize;
		doc.backImageSize = src.backImageSize;
		
		doc.preview = src.preview;
		
		delete doc.latestDoc;
		delete doc.backlinks;
		delete doc.children;
		delete doc.childrenDeep;
		delete doc.navItemElement;
		//Document.strip(doc);
				
		var d = Document.app.data;
		if (d) {
			d.setParent(doc._id, src.parent);
			if (doc._conflicts && doc._conflicts.length) {
				d.pHasConflicts = true;
				Document.app.update();
			}
		} else {
			doc.parent = src.parent;
		}
	}
	
	/**
	 * Remove nonpersistent attributes
	 */
	static strip(doc) {
		delete doc.latestDoc;
		delete doc.parentDoc;
		delete doc.level;
		delete doc.lock;
		delete doc.backlinks;
		delete doc.children;
		delete doc.childrenDeep;
		delete doc.navItemElement;
		
		if (doc.backImage) {
			delete doc.backImage.stub;
		}
	}
	
	/**
	 * Returns a clone of the doc, stripped for saving
	 */
	static clone(src) {
		if (!Document.isLoaded(src)) throw new Error('Document ' + src._id + ' is not loaded');
		
		var doc = {};
		
		doc._id = src._id;
		doc._rev = src._rev;
		
		doc.name = src.name;
		doc.type = src.type;
		doc.order = src.order;
		doc.ref = src.ref;
		doc.backColor = src.backColor;
		doc.backImage = src.backImage;
		doc.color = src.color;
		doc.content = src.content;
		doc.timestamp = src.timestamp;
		doc.labelDefinitions = src.labelDefinitions;
		doc.labels = src.labels;
		doc._attachments = src._attachments;
		doc.parent = src.parent;
		doc.content_type = src.content_type;
		doc.attachment_filename = src.attachment_filename;
		doc.changeLog = src.changeLog;
		
		doc.deleted = src.deleted;
	
		doc.editor = src.editor;
		doc.editorParams = src.editorParams;
		
		doc.links = src.links;
		doc.tags = src.tags;
		doc.navRelations = src.navRelations;
		
		doc.star = src.star;
		
		doc.boardState = src.boardState;
		
		doc.attachmentSize = src.attachmentSize;
		doc.contentSize = src.contentSize; 
		doc.changeLogSize = src.changeLogSize;
		doc.backImageSize = src.backImageSize;
		
		doc.preview = src.preview;
		
		Document.strip(doc);
		
		return doc;
	}
	
	/**
	 * Returns the CouchDB view definitions.
	 */
	static getViewDefinitions() {
		return [
			/**
			 * TOC view, just returning all metadata fields and conflicts etc., and also sets the stub flag.
			 * No attachments list, content or change logs are returned here.
			 */
			{ 
				name:'toc', 
				map: function (doc) { 
					if (doc.deleted) return;
					if (!doc.type) return;
					if ( 
						(doc.type != "note") && 
						(doc.type != "attachment") &&
						(doc.type != "reference")
					) return; 
					
					emit(doc._id, {
						_id: doc._id,
						_rev: doc._rev,
						name: doc.name,
						type: doc.type,
						parent: doc.parent,
						order: doc.order,
						ref: doc.ref,
						timestamp: doc.timestamp,
						deleted: doc.deleted,

						color: doc.color,
						backColor: doc.backColor,
						backImage: doc.backImage ? { stub: true } : false,

						editor: doc.editor,
						
						links: doc.links,
						tags: doc.tags,
						navRelations: doc.navRelations,
						
						star: doc.star,
						
						boardState: doc.boardState,

						labelDefinitions: doc.labelDefinitions,
						labels: doc.labels,

						content_type: doc.content_type,
						attachment_filename: doc.attachment_filename,
						
						preview: doc.preview,
						contentSize: doc.contentSize,
						attachmentSize: doc.attachmentSize,
						changeLogSize: doc.changeLogSize,
						backImageSize: doc.backImageSize,
						
						_conflicts: doc._conflicts,
						
						stub: true
					}); 
				}
			},
			
			/**
			 * Deleted items (trash view).
			 */
			{ 
				name:'deleted', 
				map: function (doc) {
					if (!doc.deleted) return;
					if (!doc.type) return; 
					if (
						(doc.type != "note") &&
						(doc.type != "attachment") &&
						(doc.type != "reference")
					) return;
					
					emit(doc._id, null); 
				}
			},
			
			/**
			 * Background data (bgimage view)
			 */
			{ 
				name:'bgimage', 
				map: function (doc) {
					if (doc.deleted) return;
					if (!doc.type) return; 
					if (
						(doc.type != "note") &&
						(doc.type != "attachment") &&
						(doc.type != "reference")
					) return;
					
					emit(doc._id, {
						_id: doc._id,
						_rev: doc._rev,
						backImage: doc.backImage
					}); 
				}
			}
		];
	}
	
	/**
	 * Returns a select element for the available types of document. 
	 * Attachments excluded, as these get uploaded and not created empty.
	 */
	static getAvailableTypeSelect(elementId) {
		return $('<select id="' + elementId + '">').append([
			$('<option value="note" selected>Note</option>'),
			$('<option value="reference">Reference</option>'),
			$('<option value="attachment">Attachment</option>'),
		]);
	}
	
	/**
	 * Returns the valid document types.
	 */
	static getValidDocTypes() {
		// NOTE: This must be equal to the view definitions!
		return [ 
			"attachment",
			"note",
			"reference",
		];
	}
	
	/**
	 * Returns if the type has a version history. 
	 */
	static hasTypeHistory(type) {
		return (type != 'attachment') && (type != 'reference'); 
	}
	
	/**
	 * Returns a new Editor instance for the type passed.
	 * 
	 * This only applies for editors, not pages.
	 */
	static createDocumentEditor(doc) {
		if (!doc.type) throw new Error('No document type');
		if (!Document.isTypeValid(doc.type)) throw new Error('Invalid document type: ' + doc.type);
		
		if (doc.type == 'note') {
			if (doc.editor) {
				switch(doc.editor) {
				case 'board': return new BoardEditor();
				case 'richtext': return new RichtextEditor();
				case 'code': return new CodeEditor();
				}
			} else {
				return new CodeEditor();  // formerly RichtextEditor TODO test
			}
		}
		
		return null;
	}
	
	/**
	 * Returns if the passed document can be directly restored in its editor.
	 */
	static canRestore(id) {
		var doc = Document.app.data.getById(id);
		var e = Document.createDocumentEditor(doc);
		
		return e instanceof RestorableEditor;
	}
	
	/**
	 * Sets version restore data if the editor supports it  
	 * 
	 * TODO better concept for this without pre-setting the data
	 */
	static setRestoreData(id, content) {
		var doc = Document.app.data.getById(id);
		var e = Document.createDocumentEditor(doc);
		
		if (!(e instanceof RestorableEditor)) throw new Error('Editor cannot restore: ' + id);
		
		e.setVersionRestoreData(content);
	}
	
	/**
	 * Reduces the passed documents version to save space. Returns a list of version names which have been deleted.
	 */
	static reduceVersions(doc, refTimestamp) {
		if (!refTimestamp) {
			refTimestamp = Date.now();
		}
		
		// First get a sortable array containing all versions.
		var sorted = [];
		for(var name in doc._attachments) {
			if (doc._attachments.hasOwnProperty(name)) {
				if (!name.startsWith('version_')) continue;

				var ts = parseInt(name.substring('version_'.length));
				sorted.push({
					ts: ts,
					name: name
				});
			}
		}
		
		// Sort by time stamp descending
		sorted.sort(function(a, b) { return b.ts - a.ts; });

		// Loop through the versions from the latest to the oldest,
		// deleting some of them from the document.
		var last = refTimestamp;
		var ret = [];
		for(var i in sorted) {
			var data = sorted[i];
			if (data.ts > refTimestamp) {
				console.log(" -> Versioning: Ignoring version newer than ref time stamp: " + new Date(data.ts).toLocaleString() + " is later than " + new Date(refTimestamp).toLocaleString());
				last = data.ts;
				continue;
			}
			
			// Get the time distance between the last and the current document. 
			const diffMillis = (last - data.ts);

			// Get time distance of the version to the reference time stamp (to determine which versioning interval should be applied)
			const diffRefMillis = (refTimestamp - data.ts);
			const interval = Document.getVersioningInterval(diffRefMillis);
			if (interval < 0) {
				// Keep version because it is brand new
				last = data.ts;
				continue;
			}
			
			if (diffMillis < interval) {
				// Delete version
				console.log(" -> Versioning: Deleting version " + data.name + " (" + new Date(data.ts).toLocaleString() + ")");
				delete doc._attachments[data.name];
				ret.push(data.name);
			} else {
				// Keep version
				last = data.ts;
			}
		}
		return ret;
	}
	
	/**
	 * For a given age in milliseconds, this returns the versioning interval in milliseconds.
	 */
	static getVersioningInterval(diff) {
		const diffHours = diff / 1000 / 3600;
		const diffMinutes = diff / 1000 / 60;
		if (diffMinutes <= 1) {
			// Do not delete
			return -1; 
		} else if (diffMinutes <= 10) {
			// Keep 1 each minute for the first 10 minutes
			return 1000 * 60; 
		} else if (diffMinutes <= 60) {
			// Keep 1 each 10 minutes for the first hour
			return 1000 * 60 * 10;
		} else if (diffHours <= 24) {
			// Keep 1 each hour for the first 24 hours
			return 1000 * 60 * 60;
		} else {
			// Keep 1 each day
			return 100 * 60 * 60 * 24;
		}
	}
	
	/**
	 * Returns if the passed type is valid.
	 */
	static isTypeValid(type) {
		var types = Document.getValidDocTypes();
		for(var t in types) {
			if (types[t] == type) return true;
		}
		return false;
	}
	
	/**
	 * Returns if the passed document is an attachment and an image.
	 */
	static isImage(doc) {
		if (doc.type != 'attachment') return false;
		if (!doc.content_type) return false;
		return doc.content_type.startsWith('image/');
	}
	
	/**
	 * Returns the first threshold chars of text from the document
	 */
	static createPreview(doc, threshold) {
		if (doc.type != 'note') return '';
		if (!doc.content) return '';
		
		var content = Document.getContent(doc);
		
		var pcont = (content.length > threshold) ? content.substring(0, threshold) : content;
		return $('<div></div>').html(pcont).text();
	}
	
	/**
	 * Adds an entry to the documents change log
	 */
	static addChangeLogEntry(doc, changeType, data) {
		if (!Document.isLoaded(doc)) throw new Error('Document ' + doc._id + ' is not loaded');
		
		if (!doc.changeLog) doc.changeLog = [];

		doc.changeLog.push({
			ts: Date.now(),
			user: Document.app.db.getLoggedInUser(),
			type: changeType,
			data: data
		});
	}
	
	/**
	 * Returns the given label definition if exists
	 */
	static getLabelDefinition(doc, labelId) {
		for(var l in doc.labelDefinitions || []) {
			if (doc.labelDefinitions[l].id == labelId) {
				return doc.labelDefinitions[l];
			}
		}
		return null;
	}
	
	/**
	 * Removes a label definition. Returns if anything has been removed.
	 */
	static removeLabelDefinition(doc, labelId) {
		var nlabels = [];
		var found = false;
		for(var l in doc.labelDefinitions || []) {
			if (doc.labelDefinitions[l].id == labelId) {
				found = true;
				continue;
			}
			nlabels.push(doc.labelDefinitions[l]);
		}
		if (found) {
			doc.labelDefinitions = nlabels;
			return true;
		} else {
			return false;
		}
	}
	
	/**
	 * Adds a new label definition.
	 */
	static addLabelDefinition(doc, def) {
		if (!def) throw new Error('No definition passed');
		
		var name = def.name ? def.name : ('Label-' + doc.name);
		var color = def.color ? def.color : '#06feab';
		var id = def.id ? def.id : Document.app.data.generateIdFrom(name);
		
		if (!doc.labelDefinitions) doc.labelDefinitions = [];
		doc.labelDefinitions.push({
			id: id,
			color: color,
			name: name
		});
	}
	
	/**
	 * Returns if the document has the given label ID set.
	 */
	static hasLabel(doc, labelId) {
		for(var i in doc.labels || []) {
			if (doc.labels[i] == labelId) {
				return true;
			}
		}
		return false;
	}
	
	/**
	 * Set or remove a label from the document. Returns if anything has been changed
	 */
	static toggleLabel(doc, labelId, shouldBeSet) {
		if (!doc.labels) doc.labels = [];
		
		Document.removeInvalidLabels(doc);
		
		if (this.hasLabel(doc, labelId)) {
			if (shouldBeSet) {
				// Already set
				return false;
			} else {
				// Remove
				var nl = [];
				for(var i in doc.labels) {
					if (doc.labels[i] == labelId) continue;
					nl.push(doc.labels[i]);
				}
				doc.labels = nl;
				return true;
			}
		} else {
			if (shouldBeSet) {
				doc.labels.push(labelId);
				return true;
			} else {
				// Already removed
				return false;
			}
		}
	}
	
	/**
	 * Removes all labels from the document which do not exist anymore.
	 */
	static removeInvalidLabels(doc) {
		var d = Document.app.data;

		var nl = [];
		for(var i in doc.labels) {
			var def = d.getLabelDefinition(doc._id, doc.labels[i]);
			if (!def) {
				continue;
			}
			
			nl.push(doc.labels[i]);
		}
		if (nl.length != doc.labels.length) {
			doc.labels = nl;
		}
	}
	
	/**
	 * Returns HTML elements for the labels of the document.
	 */
	static getLabelElements(doc, cssClass) {
		var labels = Document.app.data.getActiveLabelDefinitions(doc._id);
		var ret = [];
		
		for(var i in labels || []) {
			var el = $('<div class="doc-label ' + (cssClass ? cssClass : '') + '"></div>');
		
			el.css('background-color', labels[i].color);
			el.on('touchstart mousedown', function(event) {
				event.stopPropagation();
			});
			el.on('click', function(event) {
				event.stopPropagation();
				
				Document.app.routing.callLabelDefinitions(doc._id);
			})
			
			ret.push(el);
		}
		return ret;
	}
	
	/**
	 * Returns HTML elements for the hashtags of the document.
	 */
	static getTagElements(doc, cssClass) {
		var tags = Document.app.data.getTags([doc]);
		var ret = [];
		
		for(var i in tags || []) {
			var el = $('<div data-id="' + (doc ? doc._id : '') + '" data-tag="' + tags[i] + '" data-toggle="tooltip" title="' + Hashtag.startChar + tags[i] + '" class="doc-hashtag ' + (cssClass ? cssClass : '') + '"></div>');
		
			var col = Document.app.hashtag.getColor(tags[i]);
			
			el.css('background-color', col);
			el.on('touchstart mousedown', function(event) {
				event.stopPropagation();
			});
			el.on('click', function(event) {
				event.stopPropagation();
				
				const data = $(this).data();
				if (!data || !data.tag) return;
				
				if (event.ctrlKey || event.metaKey) {
					Document.app.routing.callHashtags(data.id);
				} else {
					Document.app.hashtag.showTag(data.tag);
				}
			})
			
			ret.push(el);
		}
		return ret;
	}
	
	/**
	 * Get a name for attachments
	 */
	static stripAttachmentName(fileName) {
		var strippedName = fileName.replace(/ /g, '');
	    while (strippedName.substring(0, 1) == "_") strippedName = strippedName.substring(1);
	    if (!strippedName) strippedName = "No Name";
	    return strippedName;
	}
	
	/**
	 * For the given document, this checks if there are relevant changes in comparison
	 * to the current doc state. Returns true if the tree should be rebuilt.
	 */
	static containsTreeRelevantChanges(doc, current) {
		if (!Document.app.data) return false;
		
		if (!current) {
			current = Document.app.data.getById(doc._id);
		}
		if (!current) {
			if (!doc.deleted && !doc._deleted) {
				// Document is NOT shown in the current tree, and is not deleted: Must be a new document.
				console.log("   -> New document: " + doc._id);
				return true;
			} else {
				// Document is deleted AND is not shown in the tree: Change is not relevant.
				return false;
			}
		}

		if (doc.preview != current.preview) {
			console.log("   -> Preview changed");
			return true;
		}
		
		if (doc.star != current.star) {
			console.log("   -> Star flag changed");
			return true;
		}
		
		// Node exists in the tree: Perhaps something relevant for the tree has been changed.
		if ((doc.labelDefinitions && !current.labelDefinitions) || (!doc.labelDefinitions && current.labelDefinitions)) {
			console.log("   -> Label definitions changed");
			return true;
		}
		if (doc.labelDefinitions && current.labelDefinitions && (doc.labelDefinitions.length != current.labelDefinitions.length)) {
			console.log("   -> Label definitions changed");
			return true;
		}
		
		if ((doc.labels && !current.labels) || (!doc.labels && current.labels)) {
			console.log("   -> Labels changed");
			return true;
		}
		if (doc.labels && current.labels && (doc.labels.length != current.labels.length)) {
			console.log("   -> Labels changed");
			return true;
		}
		
		if (doc.links) {
			if (!current.links) {
				console.log("   -> Links have been added");
				return true;
			}
			
			if (doc.links.length != current.links.length) {
				console.log("   -> Links have been changed");
				return true;
			}
			
			for(var c in doc.links) {
				if (doc.links[c] != current.links[c]) {
					console.log("   -> Link " + c + " changed");
					return true;
				}
			}
		} else {
			if (current.links) {
				console.log("   -> Links have been removed");
				return true;
			}
		}
		
		if (doc.tags) {
			if (!current.tags) {
				console.log("   -> Tags have been added");
				return true;
			}
			
			if (doc.tags.length != current.tags.length) {
				console.log("   -> Tags have been changed");
				return true;
			}
			
			for(var c in doc.tags) {
				if (doc.tags[c] != current.tags[c]) {
					console.log("   -> Tag " + c + " changed");
					return true;
				}
			}
		} else {
			if (current.tags) {
				console.log("   -> Tags have been removed");
				return true;
			}
		}
		
		if (doc.navRelations) {
			if (!current.navRelations) {
				console.log("   -> Navigation relations have been added");
				return true;
			}
			
			if (doc.navRelations.length != current.navRelations.length) {
				console.log("   -> Navigation relations have been changed");
				return true;
			}
			
			for(var c in doc.navRelations) {
				if (JSON.stringify(doc.navRelations[c]) != JSON.stringify(current.navRelations[c])) {
					console.log("   -> Navigation relation " + c + " changed");
					return true;
				}
			}
		} else {
			if (current.navRelations) {
				console.log("   -> Navigation relations have been removed");
				return true;
			}
		}
		
		if (doc.parent != current.parent) {
			console.log("   -> Parent changed");
			return true;
		}
		if (Object.prototype.hasOwnProperty(doc, "order")) {
			if (doc.order != current.order) {
				console.log("   -> Order changed");
				return true;
			}
		}
		if (doc.name != current.name) {
			console.log("   -> Name changed");
			return true;
		}
		if (doc.ref != current.ref) {
			console.log("   -> Reference changed");
			return true;
		}
		if (doc.type != current.type) {
			console.log("   -> Type changed");
			return true;
		}
		if (doc.backColor != current.backColor) {
			console.log("   -> Background color changed");
			return true;
		}
		
		var backImageErrors = [];
		Tools.compareObjects(doc.backimage, current.backImage, backImageErrors);
		if (backImageErrors.length > 0) {
			console.log("   -> Background image changed");
			return true;
		}
		
		if (doc.color != current.color) {
			console.log("   -> Text color changed");
			return true;
		}

		if (doc._conflicts) {
			if (!current._conflicts) {
				console.log("   -> New conflicts added");
				return true;
			}
			if (doc._conflicts.length != current._conflicts.length) {
				console.log("   -> Different amount of conflicts");
				return true;
			}
			for(var c in doc._conflicts) {
				if (doc._conflicts[c] != current._conflicts[c]) {
					console.log("   -> Conflict " + c + " changed");
					return true;
				}
			}
		}
		
		return false;
	}
	
	/**
	 * Creates the editor mode selector.
	 */
	static getEditorModeSelector(selectedValue, options) {
		var prefix = (options && options.prefix) ? options.prefix : '';
		var hideKanban = (options && options.hideKanban);
		return $('<select class="' + ((options && options.cssClass) ? options.cssClass : '')+ '"></select>').append(
			$('<option value="richtext">' + prefix + 'Rich Text</option>').prop('selected', 'richtext' == selectedValue),
			$('<option value="code">' + prefix + 'Plain Text</option>').prop('selected', 'code' == selectedValue),
			hideKanban ? null : $('<option value="board">Kanban Board</option>').prop('selected', 'board' == selectedValue),
		);
	} 
	
	/**
	 * Checks if the passed mode is valid.
	 */
	static isValidEditorMode(mode) {
		return (mode == 'richtext') || (mode == 'code') || (mode == 'board');
	}
	
	/**
	 * Returns if the document is part of a kanban board.
	 */
	static isPartOfBoard(doc) {
		if (!doc) return false;
		var d = Document.app.data;
		
		// Document itself
		if (doc.editor == 'board') return true;
		
		// Parent of the document
		if (!doc.parent) return false;
		var p = d.getById(doc.parent);
		if (!p) return false;		
		if (p.editor == 'board') return true;
		
		// Grand-Parent of the doaument
		if (!p.parent) return false;
		var p2 = d.getById(p.parent);
		if (!p2) return false;		
		if (p2.editor == 'board') return true;

		// We do not look deeper
		return false;
	}
	
	/**
	 * Shows the download dialog for the given document. Returns a Promise.
	 */
	static downloadDocumentDialog(id) {
		var d = Document.app.data;
		
		var doc = d.getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
			messageThreadId: 'DnldDocDialogMessages'
		});
		if (doc.type == 'reference') return Promise.reject({
			message: 'Cannot download a reference Document. Please download the original.',
			messageThreadId: 'DnldDocDialogMessages'
		});
		
		return new Promise(function(resolve, reject) {
			function dnldKeyPressed(e) {
			    if(e.which == 13) {
			    	$('#createSubmitButton').click();
			    }
			}
			
			$('#downloadText').html('Download options for ' + doc.name);
			
			$('#downloadDialog').off('shown.bs.modal');
			$('#downloadDialog').on('shown.bs.modal', function (e) {
				$(document).keypress(dnldKeyPressed);
			});
			$('#downloadDialog').off('hidden.bs.modal');
			$('#downloadDialog').on('hidden.bs.modal', function (e) {
				$(document).unbind('keypress', dnldKeyPressed);
				reject({
					abort: true,
					message: 'Action canceled.',
					messageThreadId: 'DnldDocDialogMessages'
				 });
			});
			
			// Preset buttons
			$('#downloadPresetDocument').off('click');
			$('#downloadPresetDocument').on('click', function(e) {
				e.stopPropagation();
				
				$('#downloadFormat').val('html');
				$('#downloadDepth').val('0');
				$('#downloadStyle').val('none');
				$('#downloadContents').val('main');
				$('#downloadTimestamps').val('main');
			});

			$('#downloadPresetToc').off('click');
			$('#downloadPresetToc').on('click', function(e) {
				e.stopPropagation();
				
				$('#downloadFormat').val('txt');
				$('#downloadDepth').val('1');
				$('#downloadStyle').val('numbers');
				$('#downloadContents').val('none');
				$('#downloadTimestamps').val('current');
			});

			// Submit button
			$('#downloadSubmitButton').off('click');
			$('#downloadSubmitButton').on('click', function(e) {
				e.stopPropagation();

				var format = $('#downloadFormat').val();
				var depth = $('#downloadDepth').val();
				var listStyle = $('#downloadStyle').val();
				var contentSel = $('#downloadContents').val();
				var timestamps = $('#downloadTimestamps').val();
				
				// File type
				var fileName = doc.name;
				var lineFeed = '\n';
				switch(format) {
				case 'txt':
					fileName += '.txt';
					break;
				case 'html':
					fileName += '.html';
					lineFeed = '<br>';
					break;
				}
			    
				var docs = d.getChildren(doc._id, true);
				docs.push(doc);
				
				Document.app.documentAccess.loadDocuments(docs)
				.then(function(data) {
					Document.downloadDocument(id, {
						format: format, 
						depth: (depth == 'all') ? 99999999 : parseInt(depth), 
						listStyle: listStyle, 
						contentSelection: contentSel,
						fileName: fileName,
						lineFeed: lineFeed,
						timestamps: timestamps,
					});
					
					resolve({
			    		ok: true
			    	});
				})
				.catch(function(err) {
					err.messageThreadId = 'DnldDocDialogMessages';
					reject(err);
				});
				
		    	$(document).unbind('keypress', dnldKeyPressed);
		    	$('#downloadDialog').off('hidden.bs.modal');
		    	$('#downloadDialog').modal('hide');
			});
			
			$('#downloadDialog').modal();
		});
	}
	
	/**
	 * Download the passed document with the given options.
	 */
	static downloadDocument(id, options) {
		if (!options) options = {}
		if (!options.format) options.format = 'txt';
		if (!options.depth) options.depth = 0;
		if (!options.listStyle) options.listStyle = 'none';
		if (!options.listSeparator) options.listSeparator = '\t';
		if (!options.contentSelection) options.contentSelection = 'all';
		if (!options.lineFeed) options.lineFeed = '\n';
		if (!options.timestamps) options.timestamps = 'all';
		if (!options.fileName) throw new Error('No filename passed for downloading');
		
		var d = Document.app.data;
		
		// Get document
		var doc = d.getById(id);
		if (!doc) throw new Error('Document ' + id + ' not found');
		
		// Get content to save
		var content = Document.collectContents(doc, 0, options);

		// Save (until now only text based file types are implemented)
		var dataBlob = new Blob([content], {type: 'text/plain'});
		var url = URL.createObjectURL(dataBlob);
		
		window.saveAs(url, options.fileName);
	}
	
	/**
	 * Helper for downloadDocument(). Collects contents recursively.
	 */
	static collectContents(doc, depth, options, prefix) {
		var d = Document.app.data;
		if (!prefix) prefix = '';
		
		var includeTimestamps = false;
		if ((options.timestamps == 'main') && (depth == 0)) includeTimestamps = true;
		if ((options.timestamps == 'current') && (depth == 0)) includeTimestamps = true;
		if (options.timestamps == 'all') includeTimestamps = true;
		
		var ts = '';
		if (includeTimestamps) {
			ts = ' (' + ((options.timestamps == 'current') ? new Date() : new Date(doc.timestamp)).toLocaleString() + ')';
		}

		var ret = prefix + doc.name + ts + options.lineFeed;
		
		var includeContent = false;
		if ((options.contentSelection == 'main') && (depth == 0)) includeContent = true;
		if (options.contentSelection == 'all') includeContent = true;
		
		if (includeContent) {
			ret += Document.getContent(doc);
			ret += options.lineFeed;
		}
		
		if (depth < options.depth) {
			var ch = d.getChildren(doc._id);
			Document.sortHierarchically(ch);
			
			var num = 1;
			for(var c in ch) {
				var prefix = '';
				for(var dd=0; dd<depth; ++dd) {
					prefix += options.listSeparator;
				}
				if (options.listStyle == 'numbers') {
					prefix += num + options.listSeparator;
				}
				if (options.listStyle == 'dashes') {
					prefix += '- ';
				}
				
				ret += Document.collectContents(ch[c], depth + 1, options, prefix);
				//ret += prefix + ch[c].name + options.lineFeed;
				
				++num;
			}
		}

		return ret;
	}
	
	/**
	 * Sorts the passed array of documents hierarchically by getHierarchicalSortOrderCriteria().
	 */
	static sortHierarchically(docs) {
		docs.sort(function(a,b) {
			var scA = Document.getHierarchicalSortOrderCriteria(a);
			var scB = Document.getHierarchicalSortOrderCriteria(b);
			
			if (scA == scB) return 0;
			else if (scA < scB) return -1;
			else return 1;
		});
	}
	
	/**
	 * Returns a sort criteria which sorts the items correctly in a hierarchical tree manner. 
	 * Only used in tree behaviour and (indirect) in BoardEditor.js (see sortHierarchically()).
	 */
	static getHierarchicalSortOrderCriteria(doc) {
		var paddedName = doc.name;
		if (paddedName.length > 5) paddedName = paddedName.substring(0, 5);
		if (paddedName.length < 5) paddedName = paddedName.padEnd(5, '_');

		var padded = Tools.pad(Document.getRelatedOrder(doc), 18) + paddedName;
		if (doc.parentDoc) {
			return Document.getHierarchicalSortOrderCriteria(doc.parentDoc) + padded;
		} else {
			return padded;
		}
	}
	
	/**
	 * Returns the default sort value for a document. This is the order value by default,
	 * otherwise the last changed timestamp.
	 */
	static getRelatedOrder(doc, parentId) {
		if (!doc) return 0;
		if (doc._id == parentId) return 0; 
		
		function defaultOrder(doc) {
			if (doc.order) return doc.order;
			return -doc.timestamp;
		}
		
		if (!parentId) {
			return defaultOrder(doc);
		}
		
		if (doc.parent == parentId) {
			return defaultOrder(doc);
		} else {
			if (doc.navRelations) {
				for(var i in doc.navRelations) {
					var rel = doc.navRelations[i];
					if (!rel) continue;
					if (!rel.id) continue;
					if (rel.id != parentId) continue;
					
					if (!rel.order) return -doc.timestamp;
					return rel.order;
				}
			}
			return -doc.timestamp;
		}
	}
	
	/**
	 * Sets the order on a document in relation to a parent.
	 */
	static setRelatedOrder(doc, parentId, newOrder) {
		if (!doc) return;

		if (!parentId) {
			parentId = doc.parent;
		}

		function debug(addText) {
			//console.log(' -> Set document order for ' + doc._id + ' in relation to parent ' + parentId + ': (' + addText + ')');
			//console.log(doc.navRelations);
		}
		
		if (doc.parent == parentId) {
			debug('Updated doc.order from ' + doc.order + ' to ' + newOrder);
			doc.order = newOrder;
		} else {
			if (!doc.navRelations) doc.navRelations = [];
			
			for(var i in doc.navRelations) {
				var rel = doc.navRelations[i];
				if (!rel) continue;
				if (!rel.id) continue;
				if (rel.id != parentId) continue;
				
				debug('Updated nav relation order from ' + rel.order + ' to ' + newOrder);
				rel.order = newOrder;
				return;
			}
			
			debug('Added new nav relation with order ' + newOrder);
			doc.navRelations.push({
				id: parentId,
				order: newOrder
			}); 
		}
	}
	
	/**
	 * Item background specific version of setBackground.
	 */
	static setItemBackground(doc, element, overrideBackColor) {
		var that = this;
		if (Document.hasBackImage(doc)) {
			// The document has a specific image for this: Start new task to load and handle the background image (which may be stubbed).
			Document.app.actions.document.loadItemBackgroundImage(doc._id)
			.then(function(backImageData) {
				that.setBackground(backImageData, overrideBackColor ? overrideBackColor : doc.backColor, element);		
			})
			.catch(function(err) {
				console.log('Error determining specific background image: ' + ((err && err.message) ? err.message : ''));
			});

		} else if (Document.isImage(doc) && Document.app.settings.settings.showAttachedImageAsItemBackground) {
			// Use the attachment image as background
			// NOTE: No size is passed here, so repeat backgrounds will not work with references, only with b64 data!
			Document.setBackground({ ref: doc._id }, overrideBackColor ? overrideBackColor : doc.backColor, element);
		} else {
			Doecument.setBackground(false, overrideBackColor ? overrideBackColor : doc.backColor, element);		
		}
	}
			
	/**
	 * Sets an appropriate background on the element, according to the document.
	 *
	 * May start async tasks to load images, but the return value denotes the type of
	 * background the document will use.
	 */
	static setBackground(imageData, backColor, element) {
		$(element).css('background', '');	
		
		/**
		 * Sets the orientation and sizing options on the element
		 */
		function handleSize(imageDataP) {
			if (imageDataP && imageDataP.size) {
				if (Math.min(imageDataP.size.width, imageDataP.size.height) < 100) {
					// Show repeated					
					$(element).css('background-repeat', backColor ? 'repeat' : 'cover, repeat');	
				} else {
					// Show all of image
					$(element).css('background-size', backColor ? 'cover' : 'cover, cover');
					$(element).css('background-position', backColor ? 'center' : 'center, center');	
				}
			} else {
				// Show all of image
				$(element).css('background-size', backColor ? 'cover' : 'cover, cover');
				$(element).css('background-position', backColor ? 'center' : 'center, center');			
			}
		}
		
		var gradient = "";
		if (backColor) {
			var gradientColor = $.Color(backColor).alpha(0.7).toRgbaString();
			gradient = 'linear-gradient(' + gradientColor + ', ' + gradientColor + '), ';
		}
		
		/**
		 * Applies the passed image data. Returns a Promise.
		 */
		function applyBackgroundImage(imageDataP) {
			if (imageDataP.data) {
				// URL background
				$(element).css('background-image', gradient + 'url("' + imageDataP.data + '")');

				handleSize(imageDataP);
				
				return Promise.resolve({
					ok: true,
					type: 'url'
				});
				
			} else if (imageDataP.ref) {
				// Reference background
				return Document.app.actions.attachmanet.getAttachmentUrl(imageDataP.ref)
				.then(function(data) {
					if (data.url) {
						$(element).css('background-image', gradient + 'url("' + data.url + '")');
						
						handleSize(imageDataP);

						return Promise.resolve({
							ok: true,
							type: 'ref'
						});
					} else {
						return Promise.reject({
							message: "Could not load referenced attachment: " + imageDataP.ref,
							messageThreadId: 'DocSetBackgroundMessages'
						});
					}
				})
				.catch(function(err) {
					return Promise.reject(err);
				});
				
			} else {
				// Error in image definition
				return Promise.reject({
					message: "Error in image definition",
					messageThreadId: 'DocSetBackgroundMessages'
				});
			}
		}
		
		if (imageData) {
			// The document has a specific image for this: Start new task to load and handle the background image (which may be stubbed)
			applyBackgroundImage(imageData)		
			.catch(function(err) {
				Document.app.showAlert(err.message ? err.message : 'Error determining background image: ' + imageData.ref, 'E', err.messageThreadId);
			});
		
		} else if (backColor) {
			// Solid background color
			if (!backColor) return false;
			$(element).css('background-color', backColor);
		}
	}
	
	/**
	 * Determines if the document has a background image or not.
	 */
	static hasBackImage(doc) {
		// Documents that have a background image will either contain its data or a stub flag.
		return !!doc.backImage;
	}
}