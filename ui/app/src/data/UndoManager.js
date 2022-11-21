/**
 * Undo manager for notes app.
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
class UndoManager {
	
	static experimentalFunctionId = 'UndoManager';
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!UndoManager.instance) UndoManager.instance = new UndoManager();
		return UndoManager.instance;
	}
	
	constructor() {
		// Initialize local data if not yet done.	
		var history = ClientState.getInstance().getUndoHistory();
		if (!history.steps) {
			history.steps = [];
			history.position = -1;
			ClientState.getInstance().setUndoHistory(history);
		}
	}

	static STEP_TYPE_DOCUMENT_BASED = 'doc';
	static STEP_TYPE_CALLBACK_BASED = 'callback';

	/**
	 * Adds a new undo step. This invalidates all steps after the current position.
	 *
	 * A step can be one of the following (all attributes are mandatory):
	 *
	 * { 
	 *   type: UndoManager.STEP_TYPE_DOCUMENT_BASED,
	 *   name: 'Name of the undo step'
	 *   doc: [Document Object to be saved to make things undone],
	 * }
	 *  
	 * or: 
	 *
	 * { 
	 *   type: UndoManager.STEP_TYPE_CALLBACK_BASED,
	 *   name: 'Name of the undo step'
	 *   undoCallback: [Callback function for undoing, parameter: the step object itself],
	 *   redoCallback: [Callback function for redoing, parameter: the step object itself],
	 * }
	 *  
	 */
	add(step) {
		var history = ClientState.getInstance().getUndoHistory();
		
		this.#checkStep(step);
		this.#condense(history);
		
		// Add step
		history.steps.push(step);
		++history.position;
		
		this.#reduce(history);
		this.#checkHistory(history);
		
		ClientState.getInstance().setUndoHistory(history);
		
		console.log(' -> UNDO MANAGER: Added step "' + step.name + '". Position: ' + history.position + ' of ' + history.steps.length);
	}
	
	/**
	 * Shortcut for add() for document based steps.
	 */
	addDocumentBased(step) {
		step.type = UndoManager.STEP_TYPE_DOCUMENT_BASED;
		this.add(step);
	}
	
	/**
	 * Shortcut for add() for callback based steps.
	 */
	addCallbackBased(step) {
		step.type = UndoManager.STEP_TYPE_CALLBACK_BASED;
		this.add(step);
	}
	
	/**
	 * Is there a undo step to be undone? history is optional for internal use.
	 */
	canUndo(history) {
		if (!history) history = ClientState.getInstance().getUndoHistory();
		this.#checkHistory(history);

		return history.position >= 0;
	}
	
	/**
	 * Is redoing possible? history is optional for internal use.
	 */
	canRedo(history) {
		if (!history) history = ClientState.getInstance().getUndoHistory();
		this.#checkHistory(history);

		return (history.position < (history.steps.length - 1));
	}
	
	/**
	 * Returns the next undo step or null. history is optional for internal use.
	 */
	getNextUndoStep(history) {
		if (!history) history = ClientState.getInstance().getUndoHistory();
		this.#checkHistory(history);

		if (!this.canUndo(history)) return null;
		
		const step = history.steps[history.position];
		this.#checkStep(step);
		
		return step;
	}
	
	/**
	 * Returns the next redo step or null. history is optional for internal use.
	 */
	getNextRedoStep(history) {
		if (!history) history = ClientState.getInstance().getUndoHistory();
		this.#checkHistory(history);

		if (!this.canRedo(history)) return null;
		
		const step = history.steps[history.position + 1];
		this.#checkStep(step);
		
		return step;
	}
	
	/**
	 * Undo last step. Returns a promise.
	 */
	undo() {
		var history = ClientState.getInstance().getUndoHistory();
		this.#checkHistory(history);

		if (!this.canUndo(history)) return Promise.resolve();
		
		const step = this.getNextUndoStep(history);
		--history.position;

		if (step.type == UndoManager.STEP_TYPE_DOCUMENT_BASED) {
			// Document undo step: These store the document to be saved to make the step undone.
			return this.#performDocumentBasedUndoStep(history, step)
			.then(function() {
				ClientState.getInstance().setUndoHistory(history);
				return Promise.resolve(step);
			});
		}
		
		if (step.type == UndoManager.STEP_TYPE_CALLBACK_BASED) {
			// Callback based undo step: Executes the passed callback with the undo step object as single parameter.
			return this.#performCallbackBasedUndoStep(history, step)
			.then(function() {
				ClientState.getInstance().setUndoHistory(history);
				return Promise.resolve(step);
			});
		}
		
		throw new Error('Invalid undo step type: ' + step.type);
	}

	/**
	 * Redo last undone step. Returns a promise.
	 */
	redo() {
		var history = ClientState.getInstance().getUndoHistory();
		if (!this.canRedo(history)) return Promise.resolve();

		const step = this.getNextRedoStep(history);		
		++history.position;
		
		if (step.type == UndoManager.STEP_TYPE_DOCUMENT_BASED) {
			// Document redo step: These store the document to be saved to make the step undone.
			return this.#performDocumentBasedRedoStep(history, step)
			.then(function() {
				ClientState.getInstance().setUndoHistory(history);
				return Promise.resolve(step);
			});
		}
		
		if (step.type == UndoManager.STEP_TYPE_CALLBACK_BASED) {
			// Callback based undo step: Executes the passed callback with the undo step object as single parameter.
			return this.#performCallbackBasedRedoStep(history, step)
			.then(function() {
				ClientState.getInstance().setUndoHistory(history);
				return Promise.resolve(step);
			});
		}
		
		throw new Error('Invalid undo step type: ' + step.type);
	}

	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Document undo step: These store the document to be saved to make the step undone.
	 */
	#performDocumentBasedUndoStep(history, step) {
		console.log(' -> UNDO MANAGER: Step "' + step.name + '": Perform undo for document ' + step.doc._id + '; New Position: ' + history.position + ' of ' + history.steps.length);
		
		// Save the document contained in the step.
		return DocumentAccess.getInstance().saveDbDocumentIgnoringRevision(step.doc)
		.then(function(resp) {
			if (!resp || !resp.ok || !resp.oldDoc) {
				return Promise.reject();
			}
			
			step.redoDoc = resp.oldDoc;
			
			return Promise.resolve(step);
		});
	}
	
	/**
	 * Document redo step: The undo step before saved a redo document.
	 */
	#performDocumentBasedRedoStep(history, step) {
		console.log(' -> UNDO MANAGER: Step "' + step.name + '": Perform redo for document ' + step.redoDoc._id + '; New Position: ' + history.position + ' of ' + history.steps.length);
		
		// Save the document contained in the step.
		return DocumentAccess.getInstance().saveDbDocumentIgnoringRevision(step.redoDoc)
		.then(function() {
			return Promise.resolve(step);
		});
	}
	
	/**
	 * Callback based undo step: Executes the passed undo callback with the undo step object as single parameter.
	 */
	#performCallbackBasedUndoStep(history, step) {
		console.log(' -> UNDO MANAGER: Step "' + step.name + '": Perform undo by callback; New Position: ' + history.position + ' of ' + history.steps.length);
		return step.undoCallback(step)
		.then(function() {
			return Promise.resolve(step);
		});
	}
	
	/**
	 * Callback based redo step: Executes the passed redo callback with the undo step object as single parameter.
	 */
	#performCallbackBasedRedoStep(history, step) {
		console.log(' -> UNDO MANAGER: Step "' + step.name + '": Perform redo by callback; New Position: ' + history.position + ' of ' + history.steps.length);
		return step.redoCallback(step)
		.then(function() {
			return Promise.resolve(step);
		});
	}
	
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Removes all steps after the current position.
	 */
	#condense(history) {
		console.log(' -> UNDO MANAGER: Condensing history, current size: ' + history.steps.length + ' ...');
		
		while(history.steps.length > (history.position + 1)) {
			history.steps.pop();
		}
		
		this.#checkHistory(history);
		
		console.log('              ... new size: ' + history.steps.length + ', position: ' + history.position);
	}
	
	/**
	 * Reduce if the max. amount of steps has been reached.
	 */
	#reduce(history) {
		while(history.steps.length > Config.undoMaxHistorySize) {
			console.log(' -> UNDO MANAGER: Max. size reached, removing first step');
			
			history.steps.shift();
			--history.position;
		}
	}
	
	/**
	 * Check step consistency.
	 */
	#checkStep(step) {
		if (!step) throw new Error('No step data');
		if (!step.type) throw new Error('No step type');
		if (!step.name) throw new Error('No step name');
		
		if (step.type == UndoManager.STEP_TYPE_DOCUMENT_BASED) {
			if (!step.doc) throw new Error('No undo document for doc based step');
			return;
		}
		
		if (step.type == UndoManager.STEP_TYPE_DOCUMENT_BASED) {
			if (!step.undoCallback) throw new Error('No undo callback for callback based undo step');
			if (!step.redoCallback) throw new Error('No redo callback for callback based undo step');
			return;
		}
		
		throw new Error('Invalid undo step type: ' + step.type);
	}
	
	/**
	 * Checks the history and position.
	 */
	#checkHistory(history) {
		if (history.position != (history.steps.length - 1)) throw new Error('Internal Error: Inconsisten UndoManager position');
		
		if (history.position < 0) throw new Error('Invalid position: ' + history.position);
		if (history.position >= history.steps.length) throw new Error('Invalid position: ' + history.position);
		
		for(var i in history.steps) {
			const step = history.steps[i];
			
			this.#checkStep(step);
			
			if (i > history.position) {
				if (step.type == UndoManager.STEP_TYPE_DOCUMENT_BASED) {
					if (!step.redoDoc) throw new Error('Internal Error: Undoed step "' + step.name + '" does not have a redo document at positon ' + i + ' of ' + history.steps.length);
				}
			}
		}
	}
}