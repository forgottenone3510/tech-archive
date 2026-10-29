const Storage = (() => {

    const STORAGE_KEY = "tech_archive_notes";


    let notes = [];


    function init(){

        const saved = localStorage.getItem(STORAGE_KEY);


        if(saved){

            try{

                notes = JSON.parse(saved);

            }
            catch(e){

                console.error(
                    "Failed to load stored notes",
                    e
                );

                notes = [];

            }

        }
        else{

            notes = [];

        }

    }


    function save(){

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(notes)
        );

    }


    function getNotes(){

        return notes;

    }


    function addNote(note){

        notes.push(note);

        save();

    }


    function updateNote(id, updated){

        const index = notes.findIndex(
            n => n.id === id
        );


        if(index === -1){

            return false;

        }


        notes[index] = {

            ...notes[index],

            ...updated,

            updated: new Date().toISOString()

        };


        save();


        return true;

    }


    function deleteNote(id){

        notes = notes.filter(
            n => n.id !== id
        );


        save();

    }


    function toggleSticky(id){

        const index = notes.findIndex(
            n => n.id === id
        );


        if(index === -1){

            return false;

        }


        notes[index] = {

            ...notes[index],

            sticky: !notes[index].sticky

        };


        save();


        return notes[index].sticky;

    }


    function setSticky(id, isSticky){

        const index = notes.findIndex(
            n => n.id === id
        );


        if(index === -1){

            return false;

        }


        notes[index] = {

            ...notes[index],

            sticky: Boolean(isSticky)

        };


        save();


        return notes[index].sticky;

    }


    function createNote(data){

        return {

            id: crypto.randomUUID(),

            title: data.title || "",

            tags: data.tags || [],

            priority: data.priority || (typeof SearchConfig !== "undefined" && SearchConfig.defaultPriority) || "Normal",

            sticky: Boolean(data.sticky),

            body: data.body || "",

            created:
                new Date().toISOString(),

            updated:
                new Date().toISOString()

        };

    }

	function importJSON(file){

		return new Promise((resolve, reject) => {

			const reader = new FileReader();


			reader.onload = (event) => {

				try {

					const data = JSON.parse(
						event.target.result
					);


					if(!data.notes || !Array.isArray(data.notes)){

						throw new Error(
							"Invalid knowledge file format"
						);

					}


					notes = data.notes;

					save();


					resolve(notes);

				}
				catch(error){

					reject(error);

				}

			};


			reader.onerror = () => {

				reject(
					reader.error
				);

			};


			reader.readAsText(file);

		});

	}



	function exportJSON(){

		const data = {

			notes: notes

		};


		const json = JSON.stringify(
			data,
			null,
			2
		);


		const blob = new Blob(
			[json],
			{
				type: "application/json"
			}
		);


		const url = URL.createObjectURL(blob);


		const now = new Date();


		const pad = (n) =>
			String(n).padStart(2, "0");


		const filename =
			"knowledge_" +
			now.getFullYear() +
			"-" +
			pad(now.getMonth()+1) +
			"-" +
			pad(now.getDate()) +
			"_" +
			pad(now.getHours()) +
			"-" +
			pad(now.getMinutes()) +
			"-" +
			pad(now.getSeconds()) +
			".json";


		const a = document.createElement("a");

		a.href = url;

		a.download = filename;

		a.click();


		URL.revokeObjectURL(url);

	}

    return {

		init,

		save,

		getNotes,

		addNote,

		updateNote,

		deleteNote,

		createNote,

		toggleSticky,

		setSticky,

		importJSON,

		exportJSON

	};


})();