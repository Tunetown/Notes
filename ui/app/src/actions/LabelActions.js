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
	
	#app = null;
	#documentAccess = null;
	
	constructor(app, documentAccess) {
		this.#app = app;
		this.#documentAccess = documentAccess;
	}
	
	/**
	 * Shows the labels of a note
	 */
	async requestLabelDefinitions(id) {
		var db = await this.#app.db.get();
		var data = await db.get(id);
			
		this.#app.loadPage(new LabelDefinitionsPage(), data);
			
		return { ok: true };
	}

	/**
	 * Saves the label definitions for the given document.
	 */
	async saveLabelDefinitions(id) {
		if (!id) throw new Error('No ID passed');
		
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Document ' + id + ' not found');
		
		Document.addChangeLogEntry(doc, 'labelDefinitionsChanged');	
			
		var dataResp = await this.#app.saveItem(id);
		
		if (dataResp.abort) {
			return dataResp;
		}
		
		// Execute callbacks
		this.#app.callbacks.executeCallbacks('saveLabelDefinitions', [doc]);
		
		console.log("Successfully saved label definitions of " + doc.name);
		
		return { 
			ok: true,
			message: "Successfully saved label definitions of " + doc.name + ".",
		};
	}
	
	/**
	 * Saves the labels for the given document.
	 */
	async saveLabels(id) {
		if (!id) throw new Error('No ID passed');
		
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Document ' + id + ' not found');
		
		Document.addChangeLogEntry(doc, 'labelsChanged');	
			
		var dataResp = await this.#documentAccess.saveItem(id);

		if (dataResp.abort) {
			return dataResp;			
		}
			
		// Execute callbacks
		this.#app.callbacks.executeCallbacks('saveLabels', doc);
				
		console.log("Successfully saved labels of " + doc.name);
				
		return { 
			ok: true,
			message: "Successfully saved labels of " + doc.name + ".",
		};
	}
	
	/**
	 * Move an item's label definition to another document.
	 * This is reusing the move target input modal dialog.
	 */
	moveLabelDefinition(id, labelId) {
		var doc = this.#app.data.getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' not found',
		});

		var def = Document.getLabelDefinition(doc, labelId);
		if (!def) return Promise.reject({
			message: 'Definition for label ' + labelId + ' not found',
		});
		
		var selector = this.getMoveLabelDefinitionTargetSelector();
		selector.css('max-width', '100%');
		selector.val(id);
		
		$('#moveTargetSelectorList').empty();
		$('#moveTargetSelectorList').append(selector);

		var tdoc;
		var that = this;
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
					});
	        		return;
	        	}

	        	tdoc = that.#app.data.getById(target);
	        	if (!tdoc) {
	        		that.#app.view.message('Please select a target document.', 'E');
	        		return;
	        	}
	       
	        	that.#documentAccess.loadDocuments([doc, tdoc])
	        	.then(function(/*resp*/) {
	        		Document.removeLabelDefinition(doc, labelId);
	        		Document.addChangeLogEntry(doc, 'labelDefinitionsChanged');	
	        		
	        		Document.addLabelDefinition(tdoc, def);
	        		Document.addChangeLogEntry(tdoc, 'labelDefinitionsChanged');	
	        		
	        		return that.#documentAccess.saveItems([doc._id, tdoc._id]);
	        	})
	        	.then(function(/*data*/) {
	        		// Execute callbacks
					that.#app.callbacks.executeCallbacks('saveLabelDefinitions', [doc, tdoc]);
					
					resolve({
						ok: true,
						newOwner: tdoc._id,
						message: 'Moved label definition ' + labelId + ' from ' + doc.name + ' to ' + tdoc.name,
					});
	        	})
	        	.catch(function(err) {
	        		reject({
						message: "Error moving label definition: " + err.message,
					});
	        	});
			});
			
			$('#moveTargetSelector').off('hidden.bs.modal');
			$('#moveTargetSelector').on('hidden.bs.modal', function () {
				reject({
					abort: true,
					message: 'Action cancelled.',
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

		var d = this.#app.data;
		
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
				$('<option value="' + ids[i].id + '">' + this.#app.view.formatSelectOptionText(ids[i].text) + '</option>')
			);
		}
		return selector;
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Convert all labels of the passed document to hashtags, and saves the result.
	 */
	convertLabelsToTags(doc) {
		if (!doc) {
			return Promise.reject({
				message: 'No document passed',
			});
		}

		if (doc.type != 'note') {
			return Promise.reject({
				message: 'Document ' + doc.name + ' must be a textual note, but is of type ' + doc.type + '. Conversion not possible.',
			});
		}
		
		if ((doc.editor != 'code') && (doc.editor != 'richtext')) {
			return Promise.reject({
				message: 'Document ' + doc.name + ' has an invalid editor mode: ' + doc.editor + '. Conversion not possible.',
			});
		}

		const labels = this.#app.data.getActiveLabelDefinitions(doc._id);
		
		if (labels.length == 0) {
			return Promise.reject({
				message: 'Document ' + doc.name + ' has no labels to convert.',
			});
		}
			
		if (!confirm('Do you want to convert ' + labels.length + ' labels of ' + doc.name + ' to hashtags? The hashtags will be added at the top of the existing content.')) {
			return Promise.reject();
		}
		
		/**
		 * Returns the content added to the parent at top.
		 */
		function getTagsText() {
			var tags = "";
			for(var l in labels) {
				const label = labels[l];
				tags += Hashtag.startChar + Hashtag.trim(label.name ? label.name : label.id) + ' ';
			}
			
			if (doc.editor == 'code') {
				return tags + '\n\n';
			}
			if (doc.editor == 'richtext') {
				return '<p>' + tags + '</p>';
			}
			return '';
		}
		
		var that = this;
		return this.#documentAccess.loadDocuments([doc])
    	.then(function(/*data*/) {
			// Set tag colors (do not overwrite any existing ones!)
			var promises = [];
			
			for(var l in labels) {
				const label = labels[l];
				const tag = (label.name ? label.name : label.id);
				if (!label.color) continue;
				if (that.#app.hashtag.hasColor(tag)) continue;
				
				// No color in meta data: Add the label color for the tag
				promises.push(that.#app.actions.hashtag.setColor(tag, label.color));
			}
			
			return Promise.all(promises);
		})
		.then(function(/*data*/) {
			// Set new content
			return that.#app.actions.document.save(doc._id, getTagsText(labels) + doc.content);
		})
		.then(function(/*data*/) {
			return that.#documentAccess.loadDocumentsById([doc._id])
		})
		.then(function(/*data*/) {
			// Remove labels
			doc = that.#app.data.getById(doc._id);
			doc.labels = [];
			return that.#documentAccess.saveItem(doc._id);
		})
		.then(function(/*data*/) {
			return that.#app.actions.nav.requestTree();
		})
		.then(function(/*data*/) {
			if (that.#app.paging.getCurrentlyShownId() == doc._id) {
				// Refresh Editor as well
				that.#app.routing.call(doc._id);
			}
			
			return Promise.resolve({
				ok: true,
				message: 'Successfully converted ' + labels.length + ' labels to hashtags in ' + doc.name,
			});
    	});
	}
}