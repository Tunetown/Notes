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
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!ReferenceActions.instance) ReferenceActions.instance = new ReferenceActions();
		return ReferenceActions.instance;
	}
	
	/**
	 * Sets a new reference target. id must be a reference.
	 */
	setReference(id) {
		var doc = Notes.getInstance().getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
			messageThreadId: 'SetRefMessages'
		});
		
		if (doc.type != 'reference') return Promise.reject({
			message: 'Document ' + id + ' is no reference',
			messageThreadId: 'SetRefMessages'
		});
		
		var existingRefs = [id];
		Notes.getInstance().getData().each(function(doc) {
			if (doc.type == 'reference') existingRefs.push(doc._id);
		});
		
		var selector = Notes.getInstance().getMoveTargetSelector(existingRefs, true);
		selector.val(doc.ref);
		
		$('#moveTargetSelectorList').empty();
		$('#moveTargetSelectorList').append(selector);

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
	        	
				var tdoc = Notes.getInstance().getData().getById(target);
	        	if (!tdoc) {
					Notes.getInstance().showAlert('Target not found: ' + target, 'E', 'SetRefMessages');
					return;
				}
				
	        	DocumentAccess.getInstance().loadDocuments([doc])
	        	.then(function(/*data*/) {
					Document.addChangeLogEntry(doc, 'referenceChanged', {
						oldRev: doc.ref,
						newRef: target
					});
					
					doc.ref = target;
					
					return DocumentAccess.getInstance().saveItem(id)
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
	 * Creates a new reference for ID.
	 */
	createReference(id) {
		var n = Notes.getInstance();

		var doc = n.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
			messageThreadId: 'CreateRefMessages'
		});
		
		var existingRefs = [id];
		n.getData().each(function(doc) {
			if (doc.type == 'reference') existingRefs.push(doc._id);
		});
		
		var selector = n.getMoveTargetSelector(existingRefs, false);
		
		$('#createReferenceDialogContent').empty();
		$('#createReferenceDialogContent').append(selector);

		// Enable searching by text entry
		selector.selectize({
			sortField: 'text'
		});

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
					var tdoc = n.getData().getById(target);
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
					_id: n.getData().generateIdFrom(doc.name),
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
				
				return Database.getInstance().get()
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
					Callbacks.getInstance().executeCallbacks('createReference', newIds);
					
					return TreeActions.getInstance().requestTree();
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
			
			$('#createReferenceDialogText').text('Create reference to ' + doc.name + ' in:');
			$('#createReferenceDialog').modal();
		});
	}	
}