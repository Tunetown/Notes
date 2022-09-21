/**
 * Actions for labels.
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
class LabelActions {
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!LabelActions.instance) LabelActions.instance = new LabelActions();
		return LabelActions.instance;
	}
	
	/**
	 * Shows the labels of a note
	 */
	requestLabelDefinitions(id) {
		var db;
		return Database.getInstance().get()
		.then(function(dbRef) {
			db = dbRef;
			return db.get(id);
		})
		.then(function (data) {
			var l = LabelDefinitions.getInstance();
			l.load(data);
			
			return Promise.resolve({ ok: true });
		});
	}

	/**
	 * Saves the label definitions for the given document.
	 */
	saveLabelDefinitions(id) {
		if (!id) return Promise.reject({ 
			message: 'No ID passed',
			messageThreadId: 'SaveLabelMessages' 
		});
		
		var n = Notes.getInstance();
		
		var doc = n.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
			messageThreadId: 'SaveLabelMessages'
		});
		
		Document.addChangeLogEntry(doc, 'labelDefinitionsChanged');	
			
		return DocumentAccess.getInstance().saveItem(id)
		.then(function(dataResp) {
			if (!dataResp.abort) {
				// Execute callbacks
				Callbacks.getInstance().executeCallbacks('saveLabelDefinitions', [doc]);
				
				console.log("Successfully saved label definitions of " + doc.name);
				
				return Promise.resolve({ 
					ok: true,
					message: "Successfully saved label definitions of " + doc.name + ".",
					messageThreadId: 'SaveLabelMessages'
				});
			} else {
				return Promise.resolve(dataResp);
			}
		});
	}
	
	
	/**
	 * Saves the labels for the given document.
	 */
	saveLabels(id) {
		if (!id) return Promise.reject({ 
			message: 'No ID passed',
			messageThreadId: 'SaveLabelMessages'
		});
		
		var n = Notes.getInstance();
		
		var doc = n.getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
			messageThreadId: 'SaveLabelMessages'
		});
		
		Document.addChangeLogEntry(doc, 'labelsChanged');	
			
		return DocumentAccess.getInstance().saveItem(id)
		.then(function(dataResp) {
			if (!dataResp.abort) {
				// Execute callbacks
				Callbacks.getInstance().executeCallbacks('saveLabels', doc);
				
				console.log("Successfully saved labels of " + doc.name);
				
				return Promise.resolve({ 
					ok: true,
					message: "Successfully saved labels of " + doc.name + ".",
					messageThreadId: 'SaveLabelMessages'
				});
			} else {
				return Promise.resolve(dataResp);
			}
		});
	}
	
	/**
	 * Move an item's label definition to another document.
	 * This is reusing the move target input modal dialog.
	 */
	moveLabelDefinition(id, labelId) {
		var doc = Notes.getInstance().getData().getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
			messageThreadId: 'MoveLabelMessages'
		});

		var def = Document.getLabelDefinition(doc, labelId);
		if (!def) return Promise.reject({
			message: 'Definition for label ' + labelId + ' not found',
			messageThreadId: 'MoveLabelMessages'
		});
		
		var selector = this.getMoveLabelDefinitionTargetSelector();
		selector.css('max-width', '100%');
		selector.val(id);
		
		$('#moveTargetSelectorList').empty();
		$('#moveTargetSelectorList').append(selector);

		var tdoc;
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
						messageThreadId: 'MoveLabelMessages'
					});
	        		return;
	        	}

	        	tdoc = Notes.getInstance().getData().getById(target);
	        	if (!tdoc) {
	        		Notes.getInstance().showAlert('Please select a target document.', 'E', 'MoveMessages');
	        		return;
	        	}
	       
	        	DocumentAccess.getInstance().loadDocuments([doc, tdoc])
	        	.then(function(/*resp*/) {
	        		Document.removeLabelDefinition(doc, labelId);
	        		Document.addChangeLogEntry(doc, 'labelDefinitionsChanged');	
	        		
	        		Document.addLabelDefinition(tdoc, def);
	        		Document.addChangeLogEntry(tdoc, 'labelDefinitionsChanged');	
	        		
	        		return DocumentAccess.getInstance().saveItems([doc._id, tdoc._id]);
	        	})
	        	.then(function(/*data*/) {
	        		// Execute callbacks
					Callbacks.getInstance().executeCallbacks('saveLabelDefinitions', [doc, tdoc]);
					
					resolve({
						ok: true,
						newOwner: tdoc._id,
						message: 'Moved label definition ' + labelId + ' from ' + doc.name + ' to ' + tdoc.name,
						messageThreadId: 'MoveLabelMessages'
					});
	        	})
	        	.catch(function(err) {
	        		reject({
						message: "Error moving label definition: " + err.message,
						messageThreadId: 'MoveLabelMessages'
					});
	        	});
			});
			
			$('#moveTargetSelector').off('hidden.bs.modal');
			$('#moveTargetSelector').on('hidden.bs.modal', function () {
				reject({
					abort: true,
					message: 'Action cancelled.',
					messageThreadId: 'MoveLabelMessages'
				});
			});
			
			$('#moveTargetSelectorSourceName').text('label definition ' + def.name);
			$('#moveTargetSelector').modal();
		});
	}
	
	/**
	 * Returns the selector for moving label definitions.
	 */
	getMoveLabelDefinitionTargetSelector() {
		var selector = $('<select></select>');
		var ids = [];

		var d = Notes.getInstance().getData();
		
		d.each(function(doc) {
			ids.push({
				text: d.getReadablePath(doc._id),
				id: doc._id,
			});
		});
		
		ids.sort(function(a, b) { 
			if (a.text < b.text) return -1;
			if (a.text > b.text) return 1;
			return 0;
		});
		
		for(var i in ids) {
			selector.append(
				$('<option value="' + ids[i].id + '">' + Notes.getInstance().formatSelectOptionText(ids[i].text) + '</option>')
			);
		}
		return selector;
	}
}