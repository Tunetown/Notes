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
	async resolveAttachment(db, id, doc) {
		try {
			return await db.getAttachment(id, 'attachment_data'); 
			
		}
		catch (e) {
			// This is for being downward compatible: Older attachment documents still use the file name as attachment name,
			// which has been changed as of version 0.90.0 because of potential collisions with other attachments. 
			console.log('WARNING: (Uncritical) Attachment document ' + id + ' uses deprecated attachment_filename.');    // TODO remove again
			
			return await db.getAttachment(id, doc.attachment_filename);
		}
	}
	
	/**
	 * Returns the attachment item as URL
	 */
	async getAttachmentUrl(id) {
		if (!id) throw new Error('No ID passed');
		
		// The attachment URLs are buffered so we can reuse blobs
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
		if (!doc) throw new Error('Item ' + id + ' does not exist');
		if (doc.type != 'attachment') throw new Error('Item ' + doc.name + ' is no attachment');
		
		var db = await this.#app.db.get();
		var data = await this.resolveAttachment(db, id, doc);

		// Get a blob URL
		var url = URL.createObjectURL(data);
	
		// Fill buffer
		if (!this.attachmentUrlBuffer) this.attachmentUrlBuffer = new Map();
		this.attachmentUrlBuffer.set(id, {
			url: url,
			blob: data	
		});
		
		return {
			ok: true,
			id: id,
			url: url,
			blob: data
		};
	}
	
	/**
	 * Adds the passed files array as attachment children to the passed document.
	 */
	async uploadAttachments(id, files) {
		var maxMB = parseFloat(this.#app.settings.settings.maxUploadSizeMB);

		for(var f in files) {
			var file = files[f];
			if (maxMB && (file.size > (maxMB * 1024 * 1024))) {
				throw new Error(file.name + ' is too large: ' + Tools.convertFilesize(file.size) + '. You can change this in the settings.');
			}
		}
		
		// Load document (if an id has been passed)
		var doc = this.#app.data.getById(id);
		if (!doc && id.length) throw new Error('Document ' + id + ' does not exist');
		if (id.length && (doc.type == 'reference')) throw new Error('Document ' + doc.name + ' is a reference and cannot have children');

		// Create the new documents for the selected attachments	    		
		var docs = [];
		
		for(var f=0; f<files.length; ++f) {   // NOTE: No shorter form possible because of the type files has. Must be that way ;)
			var file = files[f];
			var strippedName = Document.stripAttachmentName(file.name);
			
			// TODO move this to document model
		    var data = {
				_id: this.#app.data.generateIdFrom(file.name),
				type: "attachment",
				name: file.name,
				parent: id,
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
				
		// Write to db
		var db = await this.#app.db.get();
		var data = await db.bulkDocs(docs);
		
		// Get IDs of the created documents and check if all went ok
		var newIds = [];
		for(var d in data) {
			if (!data[d].ok) throw new Error(data[d].message);
			newIds.push(data[d].id);
		}
		
		// Load the documents from db
		var alldocs = await db.allDocs({
			conflicts: true,
			include_docs: true,
			keys: newIds
		});

		// Update data model
		for(var d in alldocs.rows) {
			var docc = alldocs.rows[d].doc;
			
			this.#app.data.add(docc);
		}
		
		// Execute callbacks
		this.#app.callbacks.executeCallbacks('create', newIds);
			
		return {
			ok: true,
			message: 'Successfully created ' + newIds.length + ' document(s)',
			newIds: newIds
		};
	}
	
	/**
	 * Replaces the passed doc (must be an attachment) from a file
	 */
	async updateAttachmentFromFile(id, file) {
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Document ' + id + ' does not exist');
		if (doc.type != 'attachment') throw new Error('Document ' + doc.name + ' is not an attachment');

    	var maxMB = parseFloat(this.#app.settings.settings.maxUploadSizeMB);
		if (maxMB && (file.size > (maxMB * 1024 * 1024))) {
			throw new Error('The file ' + file.name + ' is too large: ' + Tools.convertFilesize(file.size) + '. You can change this in the settings.', 'E');
		}

		await this.#documentAccess.loadDocuments([doc]);

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
			
		var data = await this.#documentAccess.saveItem(doc._id);
		if (!data.ok) throw new Error(data.message);
		
		console.log("Successfully updated " + doc.name);
		
		// Execute callbacks
		this.#app.callbacks.executeCallbacks('updateAttachment', doc);
			
		return {
			ok: true,
			message: 'Successfully updated ' + doc.name,
		};
	}
}