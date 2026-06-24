# Interfata locala pentru vanzari

Deschide `index.html` in browser pentru a lucra cu lista de clienti posibili.

## Ce face

- incarca toate lead-urile din `data/leads.js`;
- permite cautare dupa firma, operator, oras, judet, CUI, produs sau note;
- filtreaza dupa categorie, judet, agent, status si prioritate;
- permite impartirea lead-urilor intre agenti;
- salveaza modificarile in browser prin `localStorage`;
- exporta lista filtrata in CSV;
- exporta/importa backup JSON pentru alocari, statusuri, prioritati si note.

## Regenerare date dupa modificarea Excel-urilor

Ruleaza:

```powershell
python build_data.py
```

Scriptul reciteste toate fisierele `.xlsx` din folder si rescrie `data/leads.js`.
