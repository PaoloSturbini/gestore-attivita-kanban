window.KANBAN_INITIAL_PROJECTS = [
  {
    id: "progetto-sample",
    name: "Progetto sample",
    statuses: [
      { id: "todo", name: "To Do", type: "to-do", color: "#dfeec7", textColor: "#56833e" },
      { id: "doing", name: "Doing", type: "doing", color: "#cdebd9", textColor: "#418f66" },
      { id: "review", name: "In revisione", type: "custom", color: "#d8ecfb", textColor: "#2677a8" },
      { id: "done", name: "Done", type: "done", color: "#dcd8f6", textColor: "#6656dd" },
    ],
    tasks: [
      {
        id: "sample-brief",
        name: "Definire obiettivi del progetto",
        startDate: "2026-06-14",
        dueDate: "2026-06-18",
        owner: "Paolo",
        statusId: "todo",
        notes: "Attivita iniziale di esempio.",
        subtasks: [
          { id: "sample-brief-1", name: "Scrivere ambito", done: true },
          { id: "sample-brief-2", name: "Confermare priorita", done: false },
        ],
      },
      {
        id: "sample-board",
        name: "Configurare stati e viste",
        startDate: "2026-06-15",
        dueDate: "2026-06-21",
        owner: "Team",
        statusId: "doing",
        notes: "Mostra drag, colori colonna e viste alternative.",
        subtasks: [
          { id: "sample-board-1", name: "Aggiungere stato personalizzato", done: true },
          { id: "sample-board-2", name: "Provare vista tabella", done: false },
          { id: "sample-board-3", name: "Verificare export markdown", done: false },
        ],
      },
      {
        id: "sample-backup",
        name: "Provare backup e restore",
        startDate: "2026-06-16",
        dueDate: "2026-06-25",
        owner: "Sara",
        statusId: "review",
        notes: "Usa la sezione nella barra laterale.",
        subtasks: [
          { id: "sample-backup-1", name: "Creare backup JSON", done: false },
          { id: "sample-backup-2", name: "Importare progetto copia", done: false },
        ],
      },
      {
        id: "sample-done",
        name: "Installare applicazione su Mac",
        startDate: "2026-06-12",
        dueDate: "2026-06-14",
        owner: "Paolo",
        statusId: "done",
        notes: "Esempio di attivita completata.",
        subtasks: [
          { id: "sample-done-1", name: "Aprire con tasto destro", done: true },
          { id: "sample-done-2", name: "Confermare apertura", done: true },
        ],
      },
    ],
  },
];
