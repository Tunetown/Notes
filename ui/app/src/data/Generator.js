/**
 * Document Generator
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
class Generator {

	defaultOptions = {
		parentId: '',                      // ID of the parent document to fill up.
		
		numChildren: 4,                    // Number of children of each generated level.
		depth: 4,                          // Depth of hierarchy. Set to zero to just generate numChildren docs under the parent.
		contentMinSizeChars: 100,          // Minimum number of characters in random content
		contentMaxSizeChars: 1000,         // Maximum number of characters in random content. Set to zero to disable contents at all.

		randomLinkagesDensity: 0.1,        // Determines how much documents get random linkages. Range: [0..1]. Set to zero to disable.
		randomLinkagesMinAmount: 1,        // Minimum amount of linkages generated for each document that gets linkages.
		randomLinkagesMaxAmount: 2,        // Maximum amount of linkages generated for each document that gets linkages.
		
		randomReferencesDensity: 0.1,      // Determines how much documents get random references. Range: [0..1]. Set to zero to disable.
		randomReferencesMinAmount: 1,      // Minimum amount of references generated for each document that gets references.
		randomReferencesMaxAmount: 2,      // Maximum amount of references generated for each document that gets references.
	};
	
	#seed = 1;
	
	/**
	 * Returns an array with the new documents.
	 */
	createData(options) {
		// Create documents
		var ret = [];
		this.#createDataLevel(ret, options.parentId, 0, options);

		// Create linkages
		this.#createRandomLinkages(ret, options);

		// Create references
		this.#createRandomReferences(ret, options);

		// Update metadata of all documents
		for(var i in ret) {
			Document.updateMeta(ret[i]);
		}

		return ret;
	}
	
	/**
	 * Recursive helper for createData().
	 */
	#createDataLevel(ret, parentId, level, options) {
		var d = this._app.data;
		
		for(var i = 0; i<options.numChildren; ++i) {
			const name = 'Child ' + (i+1) + ' at Level ' + level;
			const id = d.generateIdFrom(name, this.#seed++);
			const type = 'note';
			const editor = (Math.random() < 0.5) ? 'code' : 'richtext'; 
			const content = this.#createContent(options);
		
			var doc = {
				_id: id,
				type: type,
				editor: editor,
				name: name,
				parent: parentId,
				order: 0,
				timestamp: Date.now(),
				content: content
			};
		    
			Document.updateMeta(doc);
			ret.push(doc);
			
			if (level < options.depth) {
				this.#createDataLevel(ret, doc._id, level + 1, options);
			}
		}
	}
	
	/**
	 * Create random linkages
	 */
	#createRandomLinkages(docs, options) {
		if (options.randomLinkagesDensity > 0) {
			for(var i in docs) {
				if (Math.random() < options.randomLinkagesDensity) {
					this.#createLinkagesFor(docs[i], docs, options);
				}
			}
		}
	}
	
	/**
	 * Creates random linkages in doc.
	 */
	#createLinkagesFor(doc, docs, options) {
		var amount = Math.random() * (options.randomLinkagesMaxAmount - options.randomLinkagesMinAmount) + options.randomLinkagesMinAmount;
		for(var a=0; a<amount; ++a) {
			var targetIndex = Math.floor(Math.random() * docs.length);
			var targetDoc = docs[targetIndex];
			
			var link = Document.composeLinkToDoc(targetDoc);
			doc.content = link + '\n\n' + doc.content; 
		}
	}
	
	/**
	 * Create random references
	 */
	#createRandomReferences(docs, options) {
		if (options.randomReferencesDensity > 0) {
			for(var i in docs) {
				if (docs[i].type == 'reference') continue;
				
				if (Math.random() < options.randomReferencesDensity) {
					this.#createReferencesFor(docs[i], docs, options);
				}
			}
		}
	}
	
	/**
	 * Creates random references in doc.
	 */
	#createReferencesFor(doc, docs, options) {
		var d = this._app.data;
		
		var amount = Math.random() * (options.randomReferencesMaxAmount - options.randomReferencesMinAmount) + options.randomReferencesMinAmount;
		for(var a=0; a<amount; ++a) {
			var targetIndex = Math.floor(Math.random() * docs.length);
			var targetDoc = docs[targetIndex];
			
			var ref = {
				_id: d.generateIdFrom(targetDoc.name, this.seed++),
				type: 'reference',
				name: targetDoc.name,
				parent: doc._id,
				ref: targetDoc._id,
				order: 0,
				timestamp: Date.now(),
			};
			
			Document.updateMeta(ref);
			
			docs.push(ref);
		}
	}
	
	/**
	 * Create content.
	 */
	#createContent(options) {
		if (options.contentMaxSizeChars <= 0) return '';
		 
		var length = Math.random() * (options.contentMaxSizeChars - options.contentMinSizeChars) + options.contentMinSizeChars;
		var result = '';
	    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 /_-������,.!=)(&%$�"){}';
	    for ( var i = 0; i < length; i++ ) {
	        result += characters.charAt(Math.floor(Math.random() * characters.length));
	    }
	    return result;
	}
}