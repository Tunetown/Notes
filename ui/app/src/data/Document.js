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
			if (!att.length) continue;
			
			doc.attachmentSize += att.length;
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
						propertyValue: Settings.getInstance().settings.defaultNoteEditor
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
						propertyValue: Settings.getInstance().settings.defaultNoteEditor
					}]
				});		
			}
		}

		AttachmentPreview.checkBasicProps(doc, errors);
		Code.checkBasicProps(doc, errors);
		Board.checkBasicProps(doc, errors);
		
		// Check label definitions and labels.
		LabelDefinitions.check(doc, errors, allDocs);
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
	}
	
	/**
	 * Gets the target document for a reference, else just returns the document.
	 */
	static getTargetDoc(doc) {
		if (!doc) return null;
		if (doc.type != 'reference') return doc;

		return Document.getTargetDoc(Notes.getInstance().getData().getById(doc.ref));
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
	 * Sets a lock for the given ID (scope is the instance). If the document is locked,
	 * it waits until the lock is free again.
	 */
	static lock(id) {
		if (!id) throw new Error('No ID passed to lock');
		
		var doc = Notes.getInstance().getData().getById(id);
		if (!doc) throw new Error('Document ' + id + ' not found');
		
		if (doc.lock) {
			throw new Error('The document ' + (doc ? doc.name : id) + ' is already locked by ' + doc.lock);
		} else {
			doc.lock = Database.getInstance().getLoggedInUser();
		}
	}
	
	/**
	 * Releases the lock of ID. Returns if the lock has been set.
	 */
	static unlock(id) {
		if (!id) throw new Error('No ID passed to lock');
		
		var doc = Notes.getInstance().getData().getById(id);
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
		
		doc.boardState = src.boardState;
		
		doc.attachmentSize = src.attachmentSize;
		doc.contentSize = src.contentSize;
		doc.changeLogSize = src.changeLogSize;
		doc.backImageSize = src.backImageSize;
		
		doc.preview = src.preview;
		
		delete doc.latestDoc;
		//Document.strip(doc);
				
		var d = Notes.getInstance().getData();
		if (d) {
			d.setParent(doc._id, src.parent);
			if (doc._conflicts && doc._conflicts.length) {
				d.pHasConflicts = true;
				Notes.getInstance().update();
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
						(doc.type != "sheet") &&
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
						(doc.type != "sheet") &&
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
						(doc.type != "sheet") &&
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
			$('<option value="sheet">Spreadsheet</option>'),
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
			"sheet",
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
	 * Returns the Editor instance for the type passed. Must have the following attributes:
	 * setCurrent(docObj)
	 * resetDirtyState()
	 * setDirty()
	 * getType()
	 * getCurrentId()
	 * getContent()
	 * load(doc)
	 * unload()
	 * stopDelayedSave()
	 * current (doc object)
	 * hideOptions()
	 * stopDelayedSave()
	 * getEditorMode()
	 * 
	 * Attachments have no such Editor, they are handled separately, as well as the Version View which 
	 * is currently just showing raw contents.
	 * 
	 */
	static getDocumentEditor(doc) {
		if (!doc.type) throw new Error('No document type');
		if (!Document.isTypeValid(doc.type)) throw new Error('Invalid document type: ' + doc.type);
		
		if (doc.type == 'sheet') return Sheet.getInstance();
		
		if (doc.type == 'note') {
			if (doc.editor) {
				switch(doc.editor) {
				case 'board': return Board.getInstance();
				case 'richtext': return Editor.getInstance();
				case 'code': return Code.getInstance();
				}
			} else {
				return Editor.getInstance();
			}
		}
		
		// NOTE: Attachments are handled directly in DocumentActions.request().
		return null;
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
			const diffHours = diffMillis / 1000 / 3600;
			
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
		var found = false;
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
			user: Database.getInstance().getLoggedInUser(),
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
		var id = def.id ? def.id : Notes.getInstance().getData().generateIdFrom(name);
		
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
		var d = Notes.getInstance().getData();

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
		var labels = Notes.getInstance().getData().getActiveLabelDefinitions(doc._id);
		var ret = [];
		
		for(var i in labels || []) {
			var el = $('<div class="doc-label ' + (cssClass ? cssClass : '') + '"></div>');
		
			el.css('background-color', labels[i].color);
			el.on('touchstart mousedown', function(event) {
				event.stopPropagation();
			});
			el.on('click', function(event) {
				event.stopPropagation();
				
				Notes.getInstance().routing.callLabelDefinitions(doc._id);
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
	static containsTreeRelevantChanges(doc) {
		if (!Notes.getInstance().getData()) return false;
		
		var current = Notes.getInstance().getData().getById(doc._id);
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
			$('<option value="code">' + prefix + 'Code</option>').prop('selected', 'code' == selectedValue),
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
		var d = Notes.getInstance().getData();
		
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
	 * Generates the options for the different editors. Returns an array holding the options divs.
	 */
	static getEditorOptionMenuItems(editor, options) {
		var n = Notes.getInstance();
		
		if (!options) options = {};
		
		if (Notes.getInstance().isMobile()) options.noOpenInNavigation = true;
		if (!editor.getEditorMode || !editor.getEditorMode()) options.noEditorModeSwitch = true;
		
		var openedDoc = editor.current;
		
		return [
			// Editor mode
			options.noEditorModeSwitch ? null : $('<div class="userbutton"></div>').append(
				Document.getEditorModeSelector(editor.getEditorMode(), {
					prefix: 'Editor: ',
					cssClass: 'userbuttonselect'
				})
				.on('change', function(event) {
					event.stopPropagation();
					editor.hideOptions();
					
					// Change board mode
					EditorActions.getInstance().saveEditorMode(editor.getCurrentId(), this.value)
					.then(function(data) {
						n.routing.call(editor.getCurrentId());
					})
					.catch(function(err) {
						Notes.getInstance().showAlert('Error: '+ err.message, "E", err.messageThreadId);
					});
				})
				.on('click', function(event) {
					event.stopPropagation();
				})
			),
			
			$('<div class="userbuttonLine"></div>'),
			
			// Share
			options.noShare ? null : $('<div class="userbutton"><div class="fa fa-share-square userbuttonIcon"></div>Share</div>')
			.on('click', function(event) {
				event.stopPropagation();
				editor.hideOptions();
				
				try {
					navigator.share({
						title: editor.current.name,
						url: location.href
					});
  
  				} catch (err) {
  					n.showAlert('Error sharing content, perhaps your browser does not support this feature yet.', 'W');
  				}
			}),
			
			// Create
			options.noCreate ? null : $('<div class="userbutton"><div class="fa fa-plus userbuttonIcon"></div>Create</div>')
			.on('click', function(event) {
				event.stopPropagation();
				editor.hideOptions();	
				
				DocumentActions.getInstance().create(editor.getCurrentId())
				.then(function(data) {
					if (data.message) {
						n.showAlert(data.message, "S", data.messageThreadId);
					}
				})
				.catch(function(err) {
					n.showAlert(err.message, err.abort ? 'I' : "E", err.messageThreadId);
				});
			}),
			
			// Rename
			options.noRename ? null : $('<div class="userbutton"><div class="fa fa-pencil-alt userbuttonIcon"></div>Rename</div>')
			.on('click', function(event) {
				event.stopPropagation();
				editor.hideOptions();	
				
				DocumentActions.getInstance().renameItem(editor.getCurrentId())
				.then(function(data) {
					if (data.message) {
						n.showAlert(data.message, "S", data.messageThreadId);
					}
					n.routing.call(editor.getCurrentId());
				})
				.catch(function(err) {
					n.showAlert(err.message, err.abort ? 'I': "E", err.messageThreadId);
				});
			}),
			
			// Move
			options.noMove ? null : $('<div class="userbutton"><div class="fa fa-arrows-alt userbuttonIcon"></div>Move</div>')
	        .on('click', function(event) {
	        	event.stopPropagation();
	        	editor.hideOptions();
	        	
	        	DocumentActions.getInstance().moveItems([editor.getCurrentId()])
	        	.catch(function(err) {
					n.showAlert(err.message, err.abort ? 'I': "E", err.messageThreadId);
				});
	        }),
	        
	        // Copy
	        options.noCopy ? null : $('<div class="userbutton"><div class="fa fa-copy userbuttonIcon"></div>Copy</div>')
	        .on('click', function(event) {
	        	event.stopPropagation();
	        	editor.hideOptions();
	        	
	        	DocumentActions.getInstance().copyItem(editor.getCurrentId())
	        	.catch(function(err) {
					n.showAlert(err.message, err.abort ? 'I': "E", err.messageThreadId);
				});
	        }),
	        
	        // Delete
	        options.noDelete ? null : $('<div class="userbutton"><div class="fa fa-trash userbuttonIcon"></div>Delete</div>')
	        .on('click', function(event) {
	        	event.stopPropagation();
	        	editor.hideOptions();	
	        	
	        	var delId = editor.getCurrentId();
	        	
	        	n.showAlert("Preparing to delete item...", 'I', 'DeleteMessages');
	        	DocumentActions.getInstance().deleteItems([delId])
				.then(function(data) {
	        		if (data.message) {
	        			n.showAlert(data.message, "S", data.messageThreadId);
	        		}
	        		n.routing.call();
	        	})
				.catch(function(err) {
	        		n.showAlert(err.message, err.abort ? 'I' : "E", err.messageThreadId);
	        		n.routing.call(delId);
	        	});
	        }),
	        
	        $('<div class="userbuttonLine"></div>'),
	        
	        // Labels
	        options.noLabelDefinitions ? null : $('<div class="userbutton"><div class="fa fa-tags userbuttonIcon"></div>Labels</div>')
	        .append(
	        	!openedDoc ? null : Document.getLabelElements(openedDoc, 'doc-label-menuoption')
	        )
	        .on('click', function(event) {
	        	event.stopPropagation();
	        	editor.hideOptions();
	        	
	        	n.routing.callLabelDefinitions(editor.getCurrentId());
	        }),

			// Create Reference
			options.noCreateReference ? null : $('<div class="userbutton"><div class="fa fa-sitemap userbuttonIcon"></div>Create Reference</div>')
			.on('click', function(event) {
				event.stopPropagation();
				editor.hideOptions();	
				
				var id = editor.getCurrentId();
				
				ReferenceActions.getInstance().createReference(id)
				.then(function(data) {
	        		if (data.message) {
	        			n.showAlert(data.message, "S", data.messageThreadId);
	        		}
					if (data.newIds && (data.newIds.length > 0)) {
						NoteTree.getInstance().focus(data.newIds[0]);
					}	        		
	        	})
				.catch(function(err) {
	        		n.showAlert(err.message, err.abort ? 'I' : "E", err.messageThreadId);
	        	});
			}),
	        
	        // References
			options.noRefs ? null : $('<div class="userbutton"><div class="fa fa-long-arrow-alt-right userbuttonIcon"></div>References</div>')
			.on('click', function(event) {
				event.stopPropagation();
				editor.hideOptions();	
				
				n.routing.call('refs/' + editor.getCurrentId());
			}),
	        
	        // History
	        options.noHistory ? null : $('<div class="userbutton"><div class="fa fa-history userbuttonIcon"></div>History</div>')
	        .on('click', function(event) {
	        	event.stopPropagation();
	        	editor.hideOptions();
	        	
	        	n.routing.call("history/" + editor.getCurrentId());
	        }),
	        
			// Download
			options.noDownload ? null : $('<div class="userbutton"><div class="fa fa-download userbuttonIcon"></div>Download</div>')
			.on('click', function(event) {
				event.stopPropagation();
				editor.hideOptions();	
				
				Document.downloadDocumentDialog(editor.getCurrentId())
				.catch(function(err) {
					n.showAlert(err.message, err.abort ? 'I' : "E", err.messageThreadId);
				});
			}),
			
	        // Show in navigation
			options.noOpenInNavigation ? null : $('<div class="userbutton"><div class="fa fa-sitemap userbuttonIcon"></div>Show in Navigation</div>')
			.on('click', function(event) {
				event.stopPropagation();
				editor.hideOptions();	
				
				NoteTree.getInstance().focus(editor.getCurrentId());
				
				n.routing.call(editor.getCurrentId());
			}),
			
			$('<div class="userbuttonLine"></div>'),
			
			 // Raw JSON view
			options.noRawView ? null : $('<div class="userbutton"><div class="fa fa-code userbuttonIcon"></div>Raw JSON</div>')
			.on('click', function(event) {
				event.stopPropagation();
				editor.hideOptions();	
				
				n.routing.callRawView(editor.getCurrentId());
			}),
		];
	}
	
	/**
	 * Shows the download dialog for the given document. Returns a Promise.
	 */
	static downloadDocumentDialog(id) {
		var n = Notes.getInstance();
		var d = n.getData();
		
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
				
				DocumentAccess.getInstance().loadDocuments(docs)
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
		
		var n = Notes.getInstance();
		var d = n.getData();
		
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
		var d = Notes.getInstance().getData();
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
			d.sortByOrder(ch);
			
			var num = 1;
			for(var c in ch) {
				var prefix = '';
				for(var d=0; d<depth; ++d) {
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
	 * Item background specific version of setBackground.
	 */
	static setItemBackground(doc, element, overrideBackColor) {
		var that = this;
		if (Document.hasBackImage(doc)) {
			// The document has a specific image for this: Start new task to load and handle the background image (which may be stubbed).
			DocumentActions.getInstance().loadItemBackgroundImage(doc._id)
			.then(function(backImageData) {
				that.setBackground(backImageData, overrideBackColor ? overrideBackColor : doc.backColor, element);		
			})
			.catch(function(err) {
				Notes.getInstance().showAlert(err.message ? err.message : 'Error determining specific background image', 'E', err.messageThreadId);
			});

		} else if (Document.isImage(doc) && Settings.getInstance().settings.showAttachedImageAsItemBackground) {
			// Use the attachment image as background
			// NOTE: No size is passed here, so repeat backgrounds will not work with references, only with b64 data!
			this.setBackground({ ref: doc._id }, overrideBackColor ? overrideBackColor : doc.backColor, element);
		} else {
			this.setBackground(false, overrideBackColor ? overrideBackColor : doc.backColor, element);		
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
				return AttachmentActions.getInstance().getAttachmentUrl(imageDataP.ref)
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
				Notes.getInstance().showAlert(err.message ? err.message : 'Error determining background image: ' + imageData.ref, 'E', err.messageThreadId);
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