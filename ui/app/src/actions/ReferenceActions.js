/**
 * Actions for reference documents.
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
class ReferenceActions {
	
	#app = null;
	#documentAccess = null;
	
	constructor(app, documentAccess) {
		this.#app = app;
		this.#documentAccess = documentAccess;
	}

	/**
	 * Sets (retargets) a new reference target. id must be a reference.
	 */
	setReference(id) {
		var doc = this.#app.data.getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
			messageThreadId: 'SetRefMessages'
		});
		
		if (doc.type != 'reference') return Promise.reject({
			message: 'Document ' + id + ' is no reference',
			messageThreadId: 'SetRefMessages'
		});
		
		var existingRefs = [id];
		this.#app.data.each(function(doc) {
			if (doc.type == 'reference') existingRefs.push(doc._id);
		});
		
		var selector = this.#app.getMoveTargetSelector(existingRefs, true);
		selector.val(doc.ref);
		
		var refDoc = this.#app.data.getById(doc.ref);
		var parentDoc = this.#app.data.getById(doc.parent);
		
		var that = this;
		$('#moveTargetSelectorList').empty();
		$('#moveTargetSelectorList').append(
			selector,
			//!parentDoc ? null : $('<hr>'),
			//!parentDoc ? null : $('<div class="deprecated"></div>').html('References are deprecated. You can convert this reference to an in-document link here:'),
			//!parentDoc ? null : $('<br>'),
			!parentDoc ? null : $('<button></button>').text('Convert to link...')
			.on('click', function(event) {
				that.convertRefToLink(doc, refDoc, parentDoc)
				.then(function(ret) {
					$('#moveTargetSelector').off('hidden.bs.modal');
		        	$('#moveTargetSelector').modal('hide');

					if (ret && ret.message) {
						that.#app.showAlert(ret.message, 'S');
					}
				})
				.catch(function(err) {
					if (err && err.message) that.#app.showAlert(err.message, 'E');
				});
			})
		);

		// Enable searching by text entry
		selector.selectize({
			sortField: 'text'
		});

		$('#moveSubmitButton').html('Save');
		
		return new Promise(function(resolve, reject) {
			$('#moveSubmitButton').off('click');
			$('#moveSubmitButton').on('click', function(/*event*/) {
				$('#moveTargetSelector').off('hidden.bs.modal');
	        	$('#moveTargetSelector').modal('hide');
	        	var target = selector.val();
	        	if (target == "_cancel") {
	        		reject({
	        			abort: true,
						message: "Action cancelled.",
						messageThreadId: 'SetRefMessages'
					});
	        		return;
	        	}
	        	
				var tdoc = that.#app.data.getById(target);
	        	if (!tdoc) {
					that.#app.showAlert('Target not found: ' + target, 'E', 'SetRefMessages');
					return;
				}
				
	        	that.#documentAccess.loadDocuments([doc])
	        	.then(function(/*data*/) {
					Document.addChangeLogEntry(doc, 'referenceChanged', {
						oldRev: doc.ref,
						newRef: target
					});
					
					doc.ref = target;
					
					return that.#documentAccess.saveItem(id)
				})
				.then(function(/*data*/) {
					resolve({
						ok: true,
						message: 'Saved new target for ' + doc.name + ' to ' + tdoc.name,
						messageThreadId: 'SetRefMessages'
					});
	        	})
	        	.catch(function(err) {
	        		reject({
						message: "Error saving target: " + err.message,
						messageThreadId: 'SetRefMessages'
					});
	        	});
			});
			
			$('#moveTargetSelector').off('hidden.bs.modal');
			$('#moveTargetSelector').on('hidden.bs.modal', function () {
				reject({
					abort: true,
					message: 'Action cancelled.',
					messageThreadId: 'SetRefMessages'
				});
			});
			
			$('#moveTargetSelectorText').text('Point ' + doc.name + ' to:');
			$('#moveTargetSelector').modal();
		});
	}
	
	/**
	 * Convert reference to link. Returns if successful.
	 */
	convertRefToLink(referenceDoc, referencedDoc, parentDoc) {
		if (!referencedDoc) {
			return Promise.reject({
				message: 'The referenced document (ID: ' + + referenceDoc.ref + ') does not exist.',
				messageThreadId: 'SetRefMessages' 
			});
		}

		if (!confirm('Do you want to convert ' + referenceDoc.name + ' to a link?\n\n- The reference ' + referenceDoc.name + ' will be deleted\n- A link to ' + referencedDoc.name + ' will be inserted at the beginning of ' + parentDoc.name)) {
			return Promise.reject();
		}
		
		if (parentDoc.type != 'note') {
			return Promise.reject({
				message: 'The parent document of this reference (ID: ' + parentDoc.name + ') must be a textual note, but is of type ' + parentDoc.type + '. Conversion not possible.',
				messageThreadId: 'SetRefMessages' 
			});
		}
		
		if ((parentDoc.editor != 'code') && (parentDoc.editor != 'richtext')) {
			return Promise.reject({
				message: 'The parent document of this reference (ID: ' + parentDoc.name + ') has an invalid editor mode: ' + parentDoc.editor + '. Conversion not possible.',
				messageThreadId: 'SetRefMessages' 
			});
		}

		/**
		 * Returns the content added to the parent at top.
		 */
		function getLinkText() {
			if (parentDoc.editor == 'code') {
				return Document.composeLinkToDoc(referencedDoc) + '\n\n';
			}
			if (parentDoc.editor == 'richtext') {
				return '<p>' + Document.composeLinkToDoc(referencedDoc) + '</p>';
			}
			return '';
		}
		
		var that = this;
		return this.#documentAccess.loadDocuments([referenceDoc, parentDoc])
    	.then(function(/*data*/) {
			return that.#app.actions.document.save(parentDoc._id, getLinkText() + parentDoc.content);
		})
		.then(function(/*data*/) {
			return that.#app.actions.document.deleteItems([referenceDoc._id], true);
		})
		.then(function(/*data*/) {
			if (that.#app.paging.getCurrentlyShownId() == parentDoc._id) {
				// Refresh Editor as well
				that.#app.routing.call(parentDoc._id);
			}
			
			return that.#app.actions.nav.requestTree();
		})
		.then(function(/*data*/) {
			return Promise.resolve({
				ok: true,
				message: 'Successfully converted reference' + referenceDoc.name,
				messageThreadId: 'SetRefMessages'
			});
    	});
	}

	/**
	 * Creates a new reference for ID.
	 */
	createReference(id) {
		var doc = this.#app.data.getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
			messageThreadId: 'CreateRefMessages'
		});
		
		var existingRefs = [id];
		this.#app.data.each(function(doc) {
			if (doc.type == 'reference') existingRefs.push(doc._id);
		});
		
		var selector = this.#app.getMoveTargetSelector(existingRefs, false);
		
		$('#createReferenceDialogContent').empty();
		$('#createReferenceDialogContent').append(selector);

		// Enable searching by text entry
		selector.selectize({
			sortField: 'text'
		});

		var that = this;
		return new Promise(function(resolve, reject) {
			$('#createReferenceDialogSubmitButton').off('click');
			$('#createReferenceDialogSubmitButton').on('click', function(/*event*/) {
				$('#createReferenceDialog').off('hidden.bs.modal');
	        	$('#createReferenceDialog').modal('hide');
	        	
	        	var target = selector.val();
	        	if (target == "_cancel") {
	        		reject({
	        			abort: true,
						message: "Action cancelled.",
						messageThreadId: 'CreateRefMessages'
					});
	        		return;
	        	}
	        	
				// Here, target can be empty for a ref at root level.
				if (target.length > 0) {
					// If there is a target, it has to really exist
					var tdoc = that.#app.data.getById(target);
		        	if (!tdoc) {
						reject({
							message: 'Target not found: ' + target,
							messageThreadId: 'CreateRefMessages'
						});
						return;
					}
				}
				
				// Create new document
				var data = {
					_id: that.#app.data.generateIdFrom(doc.name),
					type: 'reference',
					name: doc.name,
					parent: target,
					order: 0,
					timestamp: Date.now(),
					ref: id
				};
				
				Document.addChangeLogEntry(data, 'created', {
					parent: id
				});
				
				Document.updateMeta(data);
				
				var db;
				var newIds = [];
				
				return that.#app.db.get()
				.then(function(dbRef) {
					db = dbRef;
					return db.bulkDocs([data]);
				})
				.then(function(ret) {
					for(var d in ret) {
						if (!ret[d].ok) {
							return Promise.reject({
								message: 'Error: ' + ret[d].message,
								messageThreadId: 'CreateRefMessages'
							});
						}
						
						newIds.push(ret[d].id);
					}
					
					return db.allDocs({
						conflicts: true,
						include_docs: true,
						keys: newIds
					});
				})
				.then(function(/*data*/) {
					// Execute callbacks and reload data
					that.#app.callbacks.executeCallbacks('createReference', newIds);
					
					return that.#app.actions.nav.requestTree();
				})
				.then(function(/*data*/) {
					// Everything went fine
					resolve({
						ok: true,
						message: 'Successfully created ' + newIds.length + ' references.',
						messageThreadId: 'CreateRefMessages',
						newIds: newIds
					});
				})
	        	.catch(function(err) {
					// Error handling
	        		reject({
						message: "Error saving target: " + err.message,
						messageThreadId: 'CreateRefMessages'
					});
	        	});
			});
			
			$('#createReferenceDialog').off('hidden.bs.modal');
			$('#createReferenceDialog').on('hidden.bs.modal', function () {
				reject({
					abort: true,
					message: 'Action cancelled.',
					messageThreadId: 'CreateRefMessages'
				});
			});
			
			$('#createReferenceDialogText').html('Create reference to ' + doc.name + ' in: ');
			$('#createReferenceDialog').modal();
		});
	}	
}