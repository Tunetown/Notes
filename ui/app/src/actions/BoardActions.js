/**
 * Actions for board mode.
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

class BoardActions {
	
	#app = null;
	#documentAccess = null;
	
	constructor(app, documentAccess) {
		this.#app = app;
		this.#documentAccess = documentAccess;
	}
	
	/**
	 * Saves the note's board state to the server.
	 */
	async saveBoardState(id, state) {
		if (!id) throw new Error('No ID passed');
			
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Document ' + id + ' not found');

		await this.#app.#documentAccess.loadDocuments([doc]);

		doc.boardState = state;
			
		var dataResp = this.#documentAccess.saveItem(id);
		if (dataResp.abort) return;
				
		// Execute callbacks
		this.#app.callbacks.executeCallbacks('saveBoardState', doc);
		
		console.log("Successfully saved state of " + doc.name);
		
		return { 
			ok: true,
			message: "Successfully saved state of " + doc.name + ".",
		};
	}
	
	/**
	 * Loads and returns the board background for the passed document (which should be, but must not be a board).
	 */
	async getBoardBackground(id) {
		if (!id) throw new Error('No ID passed');
		
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Document ' + id + ' does not exist');
		
		var db = await this.#app.db.get();
		var attBlob = await db.getAttachment(id, 'board_background');

		var imageData = await new Promise(function(resolve) {
			var reader = new FileReader();
			reader.onload = function() {
				resolve(reader.result);
			}
			
			reader.readAsText(attBlob);
		});

		return JSON.parse(imageData);
	}
	
	/**
	 * Sets a new board background image for the given document
	 */
	async setBoardBackgroundImage(id, backImage) {
		if (!id) throw new Error('No ID passed');
		
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Document ' + id + ' not found');
		
		// Reload doc 
		doc = this.#app.data.getById(doc._id);  
			
		await this.saveBoardBackgroundImage(id, backImage);

		return {
			ok: true,
			message: 'Updated background image for ' + doc.name,
		};
	}
	
	
	/**
	 * Saves the passed image data to the passed document as board background.
	 */
	async saveBoardBackgroundImage(id, imageData) {
		var doc = this.#app.data.getById(id);
		if (!doc) throw new Error('Document ' + id + ' not found');
		
    	await this.#documentAccess.loadDocuments([doc]);

		var blobData =  new Blob([JSON.stringify(imageData)], {
		    type: 'application/json'
		});
		if (!doc._attachments) {
			doc._attachments = {};
		}
		doc._attachments['board_background'] = {
			content_type: 'application/json',
			data: blobData,
			length: blobData.size
		};
							    
		// Change log entry
		Document.addChangeLogEntry(doc, 'boardBackImageChanged', { 
			bytes: blobData.size
		});
		
    	// Save the new tree structure by updating the metadata of all touched objects.
    	await this.#documentAccess.saveItems([id]);

		// Execute callbacks
		this.#app.callbacks.executeCallbacks('setBoardBackgroundImage', doc);
    		
    	return { ok: true };
	}
}