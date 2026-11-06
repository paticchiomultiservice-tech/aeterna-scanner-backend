# AETERNA CORE Pulse365

Area clienti e scanner su https://area.aeternadigitallegacy.com/.
Configuratore distinto su https://config.aeternadigitallegacy.com/.

## Domani senza telefono

Il percorso nella vista Simulazioni permette di scegliere fino a cinque schede
dall'inventario, dichiarare dipendenze e alternative e ragionare sul telefono
principale non disponibile. Non chiama fornitori o scanner e non consuma crediti.
Gli esiti riguardano il modello dichiarato, non garantiscono il recupero reale.

Le dipendenze sono categorie e riferimenti interni. Nessun campo per password,
codici, indirizzi degli account, nomi o numeri. I metodi hanno requisiti AND;
i metodi diversi sono alternative OR. Dati sconosciuti non sono successi.
Un ciclo completo senza punto iniziale indipendente resta bloccato nel modello.

Una prova è una dichiarazione personale del cliente sul percorso preciso mostrato.
La configurazione deve essere già confermata dal server prima di una nuova prova.
Cambiare una dipendenza usata invalida quella dichiarazione. Alternative non usate
non cancellano una prova indipendente. Importare un file rende le prove dello
scenario da riesaminare, anche quando il digest coincide con una vecchia copia.

## Formati e salvataggio

- Lettura di aeterna.passport.v3 e aeterna.passport.v4.
- Il v3 remoto resta v3 fino a un'azione esplicita.
- v4 aggiunge continuity ai sei campi precedenti.
- Esportazione aeterna.passport-export.v4 con HTML statico leggibile e JSON inerte.
- Limite del Passaporto compatto: 40.000 byte UTF-8. Non viene troncato.
- Salvataggio facoltativo, revisioni confrontate e scritture fermate dopo conflitto
  o formato incompatibile.
- Un client v3 non può sovrascrivere un profilo v4.
- Le copie non sono cifrate; il profilo non offre cifratura da un capo all'altro.

GET /api/workspace/capabilities conferma il supporto tramite il gateway firmato
effettivo, con guardia aeterna.phone-loss.v1. Un flag del client non abilita v4.
Le risposte non espongono indirizzi del gateway, account o segreti.

Gli errori distinti sono WORKSPACE_CONFLICT (409),
WORKSPACE_SCHEMA_UNSUPPORTED (409), WORKSPACE_INVALID_TRANSITION (422).
Un acknowledgement valido contiene la revisione incrementata e il documento scritto.

## Contratto delle categorie

continuity contiene esattamente schema, primaryPhoneId, targetInventoryIds,
resources, methods, checks. Le risorse hanno id, kind, inventoryId, readiness,
mode, methodsComplete. I metodi hanno id, targetId, purpose, readiness, requires.
Le prove hanno inventoryId, status, declaredAt, reviewAfterDays, basisDigest,
methodIds. Sono ammesse solo dichiarazioni declared_success o declared_failure,
oltre a unrecorded e needs_review. Non esiste uno stato verified.

La base SHA-256 canonica comprende il percorso concreto, il telefono escluso e
le configurazioni degli account coinvolti. Non comprende ordini, date generali
o alternative inutilizzate. Le fixture condividono byte e digest tra browser,
Python e gateway.

## Verifiche riproducibili senza dati reali

Node.js, senza pacchetti aggiuntivi:

    node --test phone-model.test.mjs

Python, usando l'ambiente del progetto:

    python -m unittest test_phone_continuity.py -v

Le fixture sono sintetiche. I test pubblicati coprono il modello e il contratto.
Le verifiche complete del portale, delle API e del gateway sono documentate nel
resoconto di rilascio dell'ambiente di lavoro; il sorgente del gateway privato
non viene pubblicato qui.

## Distribuzione e rollback

Aggiornare prima il gateway esistente con supporto v3/v4 e protezione delle
transizioni sotto lock e revisione. Poi distribuire il commit completo di server
e frontend sul servizio Render già esistente. Conservare sessioni, CSRF, origini,
piani, scadenze e crediti.

Per disabilitare il nuovo percorso, togliere il suo ingresso mantenendo lettura,
validazione, esportazione v4 e guardie del gateway. Dopo il primo v4 salvato,
non ripristinare un backend che legge solo v3.

La funzione non modifica prezzi, checkout o documenti accettati. Audit,
pagamenti e consegne assistite restano attività nel perimetro concordato.



