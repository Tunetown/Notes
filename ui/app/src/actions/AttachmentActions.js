/**
 * Actions for attachment documents.
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
class AttachmentActions {
	
	#app = null;
	#documentAccess = null;
	
	constructor(app, documentAccess) {
		this.#app = app;
		this.#documentAccess = documentAccess;
	}
	
	/**
	 * Returns a Promise with the attachment data. 
	 */
	resolveAttachment(db, id, doc) {
		return db.getAttachment(id, 'attachment_data')
		.catch(function(/*err*/) {
			// This is for being downward compatible: Older attachment documents still use the file name as attachment name,
			// which has been changed as of version 0.90.0 because of potential collisions with other attachments. 
			//console.log('WARNING: (Uncritical) Attachment document ' + id + ' uses deprecated attachment_filename.');
			
			return db.getAttachment(id, doc.attachment_filename);
		});
	}
	
	/**
	 * Returns the attachment item as URL
	 */
	getAttachmentUrl(id) {
		if (!id) return Promise.reject({ 
			message: 'No ID passed',
			messageThreadId: 'GetAttUrlMessages'
		});
		
		if (this.attachmentUrlBuffer) {
			var buf = this.attachmentUrlBuffer.get(id);
			
			if (buf) return Promise.resolve({
				ok: true,
				id: id,
				buffered: true,
				url: buf.url,
				blob: buf.blob
			});
		}
		
		var doc = this.#app.data.getById(id);
		if (!doc) {
			return Promise.reject({
				message: 'Item ' + id + ' does not exist',
				messageThreadId: 'GetAttUrlMessages'
			});
		}
		if (doc.type != 'attachment') {
			return Promise.reject({
				message: 'Item ' + doc.name + ' is no attachment',
				messageThreadId: 'GetAttUrlMessages'
			});
		}
		
		var that = this;
		return this.#app.db.get()
		.then(function(db) {
			return that.resolveAttachment(db, id, doc);
		})
		.then(function(data) {
			var url = URL.createObjectURL(data);
	
			if (!that.attachmentUrlBuffer) that.attachmentUrlBuffer = new Map();
			that.attachmentUrlBuffer.set(id, {
				url: url,
				blob: data	
			});
			
			return Promise.resolve({
				ok: true,
				id: id,
				url: url,
				blob: data
			});
		});
	}
	
	/**
	 * Adds the passed files array as attachment children to the passed document.
	 */
	uploadAttachments(id, files) {
		var maxMB = parseFloat(this.#app.settings.settings.maxUploadSizeMB);
		for(var f in files) {
			var file = files[f];
			if (maxMB && (file.size > (maxMB * 1024 * 1024))) {
				return Promise.reject({
					message: file.name + ' is too large: ' + Tools.convertFilesize(file.size) + '. You can change this in the settings.',
					messageThreadId: 'UpdateAttMessages'
				});
			}
		}
		
		var doc = this.#app.data.getById(id);
		if (!doc && id.length) return Promise.reject({
			message: 'Document ' + id + ' does not exist',
			messageThreadId: 'UpdateAttMessages'
		});  
		
		if (id.length && (doc.type == 'reference')) return Promise.reject({
			message: 'Document ' + doc.name + ' is a reference and cannot have children',
			messageThreadId: 'UpdateAttMessages'
		});

		var docs = [];
		var newIds = [];
		var targetId = id;
		
		var db;
		var that = this;
		return new Promise(function(resolve, reject) {
			$('#dropFilesText').html('Add ' + files.length + ' files?');
			
			var existingRefs = [];
			that.#app.data.each(function(doc) {
				if (doc.type == 'reference') existingRefs.push(doc._id);
			});
			
			var targetSelector = that.#app.getMoveTargetSelector(existingRefs);
			targetSelector.css('width', '100%');
			targetSelector.val(id);
			
			$('#dropFilesSelectorContainer').empty();
			$('#dropFilesSelectorContainer').append(targetSelector);
			
			function keyPressed(e) {
			    if(e.which == 13) {
			    	$('#dropFilesSubmitButton').click();
			    }
			}
			
			$('#dropFilesDialog').off('shown.bs.modal');
			$('#dropFilesDialog').on('shown.bs.modal', function (e) {
				$(document).keypress(keyPressed);
			});
			$('#dropFilesDialog').off('hidden.bs.modal');
			$('#dropFilesDialog').on('hidden.bs.modal', function (e) {
				$(document).unbind('keypress', keyPressed);
				reject({
					abort: true,
					message: 'Action canceled.',
					messageThreadId: 'UpdateAttMessages'
				 });
			});
			$('#dropFilesDialog').modal();
			
			// Set up submit button
			$('#dropFilesSubmitButton').off('click');
			$('#dropFilesSubmitButton').on('click', function(e) {
				e.stopPropagation();

				targetId = targetSelector.val();
				if (targetId != id) {
					doc = that.#app.data.getById(targetId);
					if (!doc && targetId.length) {
						that.#app.showAlert('Document ' + targetId + ' not found', 'E', 'UplAttMessages');
						return;
					}
				}
	    		
				for(var f=0; f<files.length; ++f) {   // NOTE: No shorter form possible because of the type files has. Must be that way ;)
					var file = files[f];
					var strippedName = Document.stripAttachmentName(file.name);
					
				    var data = {
						_id: that.#app.data.generateIdFrom(file.name),
						type: "attachment",
						name: file.name,
						parent: targetId,
						order: 0,
						timestamp: file.lastModified,
						content_type: file.type,
						attachment_filename: strippedName,
						attachmentSize: file.size,          // Set here because the attachment has no length attribute yet.
						_attachments: {}
					};
				    
				    data._attachments['attachment_data'] = {
						content_type: file.type,
		    			data: file,
						length: file.size
					};
				    
					Document.updateMeta(data);
					
					docs.push(data);
				}
				
		    	$(document).unbind('keypress', keyPressed);
		    	$('#dropFilesDialog').off('hidden.bs.modal');
		    	$('#dropFilesDialog').modal('hide');

		    	resolve({
		    		ok: true
		    	});
			});
		})
		.then(function(data) {
			if (!data.ok) {
				return Promise.reject(data);
			}
			return that.#app.db.get();
		})
		.then(function(dbRef) {
			db = dbRef;
			
			return db.bulkDocs(docs);
		})
		.then(function (data) {
			for(var d in data) {
				if (!data[d].ok) {
					return Promise.reject({
						message: 'Error: ' + data[d].message,
						messageThreadId: 'UpdateAttMessages'
					});
				}
				
				newIds.push(data[d].id);
			}
			
			return db.allDocs({
				conflicts: true,
				include_docs: true,
				keys: newIds
			});
		})
		.then(function(data) {
			for(var d in data.rows) {
				var docc = data.rows[d].doc;
				
				// Update data model
				that.#app.data.add(docc);
			}
			
			that.#app.routing.call(targetId);
			
			// Execute callbacks
			that.#app.callbacks.executeCallbacks('create', newIds);
			
			return Promise.resolve({
				ok: true,
				message: 'Successfully created ' + newIds.length + ' document(s)',
				messageThreadId: 'UpdateAttMessages',
				newIds: newIds
			});
		}); 
	}
	
	/**
	 * Replaces the passed doc (must be an attachment) from a file
	 */
	updateAttachmentFromFile(id) {
		var doc = this.#app.data.getById(id);
		if (!doc) return Promise.reject({
			message: 'Document ' + id + ' does not exist',
			messageThreadId: 'UpdateAttUrlMessages'
		});  
		
		if (doc.type != 'attachment') return Promise.reject({
			message: 'Document ' + doc.name + ' is not an attachment',
			messageThreadId: 'UpdateAttUrlMessages'
		});

		var file;
		var that = this;
		return new Promise(function(resolve, reject) {
			$('#uploadFile').val('');

			$('#uploadText').html('Upload content for ' + doc.name);
			
			function keyPressed(e) {
			    if(e.which == 13) {
			    	$('#uploadSubmitButton').click();
			    }
			}
			
			$('#uploadDialog').off('shown.bs.modal');
			$('#uploadDialog').on('shown.bs.modal', function (/*event*/) {
				$(document).keypress(keyPressed);
			});
			$('#uploadDialog').off('hidden.bs.modal');
			$('#uploadDialog').on('hidden.bs.modal', function (/*event*/) {
				$(document).unbind('keypress', keyPressed);
				reject({
					abort: true,
					message: 'Action canceled.',
					messageThreadId: 'UpdateAttUrlMessages'
				 });
			});
			$('#uploadDialog').modal();
			
			// Set up submit button
			$('#uploadSubmitButton').off('click');
			$('#uploadSubmitButton').on('click', function(e) {
				e.stopPropagation();

	    		file = $('#uploadFile')[0].files[0];
	    		
	    		if (!file) {
	    			that.#app.showAlert('Please select a file to upload.', 'E', 'UplAttMessages');
					return;
			    }

	    		var maxMB = parseFloat(that.#app.settings.settings.maxUploadSizeMB);
	    		if (maxMB && (file.size > (maxMB * 1024 * 1024))) {
	    			that.#app.showAlert('The file is too large: ' + Tools.convertFilesize(file.size) + '. You can change this in the settings.', 'E', 'UpdateAttUrlMessages');
					return;
	    		}
		    		
		    	$(document).unbind('keypress', keyPressed);
		    	$('#uploadDialog').off('hidden.bs.modal');
		    	$('#uploadDialog').modal('hide');
			    
		    	resolve({
		    		ok: true
		    	});
			});
		})
		.then(function(data) {
			if (!data.ok) {
				return Promise.reject(data);
			}
			return that.#documentAccess.loadDocuments([doc]);
		})
		.then(function(/*data*/) {
			var strippedName = Document.stripAttachmentName(file.name);
			
			doc.attachment_filename = strippedName;
			doc.timestamp = file.lastModified;
			doc.content_type = file.type;
			    
			doc._attachments['attachment_data'] = {
				content_type: file.type,
    			data: file,
				length: file.size
			};
		    
			Document.updateMeta(doc);
			
		    return that.#documentAccess.saveItem(doc._id);
		})
		.then(function (data) {
			if (!data.ok) {
				return Promise.reject({
					message: 'Error: ' + data.message,
					messageThreadId: 'UpdateAttUrlMessages'
				});
			}
			
			console.log("Successfully updated " + doc.name);
			
			// Execute callbacks
			that.#app.callbacks.executeCallbacks('updateAttachment', doc);
			
			return Promise.resolve({
				ok: true,
				message: 'Successfully updated ' + doc.name,
				messageThreadId: 'UpdateAttUrlMessages'
			});
		});
	}
}