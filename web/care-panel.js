import {ROLE_TYPES,ROLE_SCOPES,FUTURE_KEYS,FUTURE_CHOICES,MEMORY_TOPICS,REVIEW_DAYS,saveRole,removeRole,setFuture,setMemory,setReview} from './care-model.mjs';
import {DIMENSIONS,PHASES,PHASE_DIMENSIONS,effectivePhaseStatus} from './core-model.mjs';
import {CORE_COPY} from './core-copy.js';
import {EXTRA_COPY} from './extra-copy.js';
const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keys=['title','intro','roles','roleHelp','role','scope','alternate','future','futureHelp','memory','memoryHelp','prepared','review','reviewHelp','checked','cadence','days','last','assist','assistHelp','download','mail','draftOnly','overview','open','recheck','declaration','unknown','familyCheck'];
const rows={
it:['Famiglia, memoria e continuità','Scegli un piccolo passo. Queste schede conservano categorie e dichiarazioni nella tua copia, non nomi, contatti o segreti.','Persone di fiducia e limiti','Prepara un ruolo e una persona alternativa. Completa nomi e recapiti privatamente su carta; questa scheda non concede accessi o poteri.','Chi potrebbe aiutarti?','Per quale parte?','Ho previsto un’alternativa se questa persona non è disponibile','Voce, volto e rappresentazioni AI','Registra separatamente ciò che vuoi evitare o discutere. Sono orientamenti da approfondire: nessun testamento o consenso universale viene creato.','Una Goccia di Memoria','Scegli una cosa da riordinare nei tuoi strumenti: una foto, un ricordo, un valore o un’istruzione. Non carichiamo il contenuto.','Ho preparato e ritrovato la mia copia nei miei strumenti','Il mio appuntamento Pulse','Scegli ogni quanto ricontrollare il piano e aggiungi tu il promemoria al calendario. Non inviamo avvisi né interpretiamo il silenzio come emergenza.','Ho ricontrollato le informazioni del mio piano','Ogni quanti giorni?','giorni','Ultimo controllo dichiarato','Chiedi una mano','Prepara una richiesta senza segreti. Aggiungi il riferimento ordine nel tuo programma email. Nessun ticket o appuntamento viene creato qui.','Scarica la bozza di richiesta','Apri la bozza nella mia email','Bozza preparata, non inviata. L’invio e la ricezione devono essere confermati separatamente.','Il tuo quadro di oggi','Da preparare o provare','Da ricontrollare','Prove dichiarate, non certificazioni','Non ancora indicato','Verifica in famiglia: fermati, richiama un numero già noto, prevedi una seconda persona. Non annotare qui una frase segreta.'],
en:['Family, memories and continuity','Choose a small step. These cards keep categories and declarations in your copy, not names, contacts or secrets.','Trusted people and limits','Prepare a role and an alternative helper. Add names and contacts privately on paper; this card grants no access or powers.','Who could help?','With which area?','I planned an alternative if this person is unavailable','Voice, face and AI representations','Record separately what you want to avoid or discuss. These are preferences to explore, not a will or universal consent.','A Drop of Memory','Choose one thing to organise in your own tools: a photo, story, value or instruction. We do not upload the content.','I prepared and located my copy in my own tools','My Pulse appointment','Choose when to review the plan and add the reminder to your calendar yourself. No alerts are sent; silence is not treated as an emergency.','I reviewed the information in my plan','How many days between reviews?','days','Last declared review','Ask for a hand','Prepare a request without secrets. Add your order reference in your email app. No ticket or appointment is created here.','Download the request draft','Open the draft in my email','Draft prepared, not sent. Sending and receipt must be confirmed separately.','Your picture today','To prepare or test','To review','Declared tests, not certifications','Not recorded yet','Family check: pause, call a known number and plan another trusted person. Do not record a secret phrase here.'],
fr:['Famille, mémoire et continuité','Choisissez un petit pas. Ces fiches conservent catégories et déclarations dans votre copie, pas de noms, contacts ou secrets.','Personnes de confiance et limites','Préparez un rôle et une alternative. Complétez les contacts sur papier en privé ; cette fiche ne donne ni accès ni pouvoirs.','Qui pourrait aider ?','Pour quelle partie ?','J’ai prévu une alternative si cette personne est indisponible','Voix, visage et représentations IA','Notez séparément ce que vous souhaitez éviter ou discuter. Ce sont des orientations, pas un testament ou consentement universel.','Une Goutte de Mémoire','Choisissez une photo, un récit, une valeur ou une instruction à organiser dans vos outils. Aucun contenu n’est chargé.','J’ai préparé et retrouvé ma copie dans mes outils','Mon rendez-vous Pulse','Choisissez la fréquence de révision et ajoutez vous-même le rappel au calendrier. Aucun avis envoyé ; le silence ne déclenche pas d’urgence.','J’ai revu les informations de mon plan','Combien de jours entre les révisions ?','jours','Dernière révision déclarée','Demander de l’aide','Préparez une demande sans secrets. Ajoutez la référence de commande dans votre messagerie. Aucun ticket ou rendez-vous n’est créé ici.','Télécharger le brouillon','Ouvrir le brouillon dans ma messagerie','Brouillon préparé, non envoyé. Envoi et réception restent à confirmer séparément.','Votre situation aujourd’hui','À préparer ou tester','À revoir','Tests déclarés, pas certifications','Pas encore indiqué','Vérification familiale : faites une pause, rappelez un numéro connu et prévoyez une autre personne. Aucune phrase secrète ici.'],
es:['Familia, memoria y continuidad','Elige un pequeño paso. Estas fichas guardan categorías y declaraciones en tu copia, no nombres, contactos ni secretos.','Personas de confianza y límites','Prepara un papel y una persona alternativa. Completa los contactos en privado sobre papel; esta ficha no concede accesos ni poderes.','¿Quién podría ayudar?','¿En qué parte?','He previsto una alternativa si esta persona no está disponible','Voz, rostro y representaciones IA','Anota por separado lo que quieres evitar o consultar. Son orientaciones, no un testamento ni consentimiento universal.','Una Gota de Memoria','Elige una foto, historia, valor o instrucción para ordenar en tus herramientas. No cargamos el contenido.','He preparado y encontrado mi copia en mis herramientas','Mi cita Pulse','Elige cuándo revisar el plan y añade el recordatorio a tu calendario. No enviamos avisos ni interpretamos el silencio como emergencia.','He revisado la información de mi plan','¿Cuántos días entre revisiones?','días','Última revisión declarada','Pide ayuda','Prepara una solicitud sin secretos. Añade la referencia del pedido en tu correo. Aquí no se crea ningún ticket ni cita.','Descargar borrador de solicitud','Abrir el borrador en mi correo','Borrador preparado, no enviado. Envío y recepción deben confirmarse por separado.','Tu situación de hoy','Por preparar o probar','Por revisar','Pruebas declaradas, no certificaciones','Todavía no indicado','Verificación familiar: para, llama a un número conocido y prevé otra persona. No anotes una frase secreta aquí.'],
pt:['Família, memória e continuidade','Escolha um pequeno passo. Estas fichas guardam categorias e declarações na sua cópia, não nomes, contactos ou segredos.','Pessoas de confiança e limites','Prepare um papel e uma pessoa alternativa. Complete contactos em papel privado; esta ficha não dá acessos nem poderes.','Quem poderia ajudar?','Em que parte?','Previ uma alternativa se esta pessoa estiver indisponível','Voz, rosto e representações IA','Registe separadamente o que quer evitar ou discutir. São orientações, não um testamento nem consentimento universal.','Uma Gota de Memória','Escolha uma fotografia, história, valor ou instrução para organizar nas suas ferramentas. Não carregamos conteúdo.','Preparei e encontrei a minha cópia nas minhas ferramentas','O meu compromisso Pulse','Escolha quando rever o plano e adicione o lembrete ao calendário. Não enviamos avisos nem tratamos silêncio como emergência.','Revi as informações do meu plano','Quantos dias entre revisões?','dias','Última revisão declarada','Pedir ajuda','Prepare um pedido sem segredos. Adicione a referência da encomenda no seu email. Aqui não é criado nenhum ticket ou agendamento.','Descarregar o rascunho','Abrir o rascunho no meu email','Rascunho preparado, não enviado. Envio e receção exigem confirmação separada.','A sua situação hoje','Por preparar ou testar','Por rever','Testes declarados, não certificações','Ainda não indicado','Verificação familiar: pare, ligue para um número conhecido e preveja outra pessoa. Não registe aqui uma frase secreta.']};
const categories={
it:{roles:['Partner','Figlio o figlia','Altro familiare','Amico o amica','Collega','Professionista','Altra persona'],scopes:['Contatti e istruzioni','Accessi e recupero','Archivi e copie','Lavoro','Istruzioni future'],choices:['Non ho ancora deciso','Preferisco evitare questo uso','Voglio discuterne e definire i limiti'],future:['Voce','Volto e immagini','Stile di scrittura o rappresentazione'],memory:['Scelgo più avanti','Una foto','Un ricordo scritto','Un valore da trasmettere','Un’istruzione utile']},
en:{roles:['Partner','Child','Other relative','Friend','Colleague','Professional','Other person'],scopes:['Contacts and instructions','Access and recovery','Archives and copies','Work','Future instructions'],choices:['Not decided yet','I prefer to avoid this use','I want to discuss it and define limits'],future:['Voice','Face and images','Writing style or representation'],memory:['Choose later','A photo','A written memory','A value to pass on','A useful instruction']},
fr:{roles:['Partenaire','Enfant','Autre proche','Ami','Collègue','Professionnel','Autre personne'],scopes:['Contacts et instructions','Accès et récupération','Archives et copies','Travail','Instructions futures'],choices:['Pas encore décidé','Je préfère éviter cet usage','Je veux en discuter et définir les limites'],future:['Voix','Visage et images','Style écrit ou représentation'],memory:['Choisir plus tard','Une photo','Un souvenir écrit','Une valeur à transmettre','Une instruction utile']},
es:{roles:['Pareja','Hijo o hija','Otro familiar','Amigo o amiga','Colega','Profesional','Otra persona'],scopes:['Contactos e instrucciones','Accesos y recuperación','Archivos y copias','Trabajo','Instrucciones futuras'],choices:['Todavía sin decidir','Prefiero evitar este uso','Quiero consultarlo y definir límites'],future:['Voz','Rostro e imágenes','Estilo escrito o representación'],memory:['Elegir más adelante','Una foto','Un recuerdo escrito','Un valor que transmitir','Una instrucción útil']},
pt:{roles:['Parceiro','Filho ou filha','Outro familiar','Amigo','Colega','Profissional','Outra pessoa'],scopes:['Contactos e instruções','Acessos e recuperação','Arquivos e cópias','Trabalho','Instruções futuras'],choices:['Ainda não decidi','Prefiro evitar este uso','Quero discutir e definir limites'],future:['Voz','Rosto e imagens','Estilo escrito ou representação'],memory:['Escolher mais tarde','Uma fotografia','Uma memória escrita','Um valor a transmitir','Uma instrução útil']}};
const PLAIN_CARE={
  "it": {
    "ui": {
      "title": "Persone, ricordi e prossimi controlli",
      "intro": "Qui prepari un piccolo passo alla volta. Scegli solo il tipo di persona o di aiuto. Nomi e recapiti restano nei tuoi strumenti, non in queste schede.",
      "roles": "Chi potrebbe aiutarti?",
      "roleHelp": "Pensa a una persona con cui ne hai parlato. Qui scegli il suo ruolo, non scrivi il nome. Esempio: “Amico o amica” per una persona che può aiutarti a trovare un documento.",
      "role": "Che rapporto hai con questa persona?",
      "scope": "In che cosa potrebbe aiutarti?",
      "alternate": "Ho pensato a un'altra persona se la prima manca",
      "future": "Come vorrei fosse usata la mia voce o immagine",
      "memory": "Un ricordo da conservare",
      "review": "Quando ricontrollare il piano",
      "prepared": "Ho ritrovato e aperto la copia che avevo preparato",
      "checked": "Ho già ricontrollato le informazioni del piano",
      "cadence": "Ogni quanti giorni vuoi ricontrollare?",
      "declaration": "Questi sono i passi che dichiari di aver fatto, non controlli effettuati da AETERNA."
    },
    "help": {
      "role": "Scegli solo una categoria, per esempio familiare o collega. Non occorre scrivere il nome qui.",
      "scope": "Scegli una cosa precisa. Per esempio: trovare le copie dei documenti. Questo non permette alla persona di entrare nei tuoi account.",
      "alternate": "Spunta se hai già pensato a una seconda persona. La prima potrebbe non rispondere quando serve.",
      "future": "Puoi lasciare “Non ho ancora deciso”. Esempio: preferisci discutere prima che qualcuno usi la tua voce per creare un audio AI.",
      "memory": "Scegli un solo ricordo da sistemare nei tuoi strumenti. Esempio: una foto già tua con due righe di spiegazione. Qui non carichi la foto.",
      "prepared": "Spunta solo dopo aver trovato e aperto la copia. Avere scelto “Una foto” non significa averla salvata.",
      "cadence": "30 giorni significa circa una volta al mese. Scegli un ritmo che puoi seguire. Il promemoria va aggiunto da te al calendario.",
      "checked": "Spunta dopo aver controllato davvero. La data sotto dice quando hai segnato il controllo; non prova che le informazioni siano ancora giuste oggi."
    }
  },
  "en": {
    "ui": {
      "title": "People, memories and next checks",
      "intro": "Prepare one small step at a time. Choose only the type of person or help. Names and contacts stay in your own tools, not these cards.",
      "roles": "Who could help you?",
      "roleHelp": "Think of someone you have spoken with. Choose their role here, not their name. Example: “Friend” for someone who may help find a document.",
      "role": "How do you know this person?",
      "scope": "What could they help with?",
      "alternate": "I thought of another person if the first is unavailable",
      "future": "How I want my voice or image to be used",
      "memory": "A memory to keep",
      "review": "When to check the plan again",
      "prepared": "I found and opened the copy I prepared",
      "checked": "I have reviewed the plan's information",
      "cadence": "How many days between checks?",
      "declaration": "These are steps you report doing, not checks performed by AETERNA."
    },
    "help": {
      "role": "Choose a category, such as relative or colleague. No name is needed here.",
      "scope": "Choose one clear task, such as finding document copies. This does not let the person access your accounts.",
      "alternate": "Tick if you have thought of a second person. The first might not answer when needed.",
      "future": "You may leave “Not decided yet”. For example: you want to discuss someone using your voice in AI audio first.",
      "memory": "Choose one memory to organise in your own tools. For example: a photo you own with two lines of explanation. You do not upload it here.",
      "prepared": "Tick only after finding and opening the copy. Choosing “A photo” does not save the photo.",
      "cadence": "30 days is about once a month. Choose a rhythm you can follow. Add the reminder to your calendar yourself.",
      "checked": "Tick after actually checking. The date below records when you reported it; it does not prove the information is still right today."
    }
  },
  "fr": {
    "ui": {
      "title": "Personnes, souvenirs et prochains contrôles",
      "intro": "Préparez une petite étape à la fois. Choisissez seulement le type de personne ou d'aide. Les noms et contacts restent dans vos outils.",
      "roles": "Qui pourrait vous aider ?",
      "roleHelp": "Pensez à une personne avec qui vous en avez parlé. Choisissez son rôle, pas son nom. Exemple : un ami qui aide à retrouver un document.",
      "role": "Quel est votre lien avec cette personne ?",
      "scope": "Pour quelle tâche pourrait-elle aider ?",
      "alternate": "J'ai pensé à une autre personne si la première manque",
      "future": "Comment je souhaite utiliser ma voix ou mon image",
      "memory": "Un souvenir à garder",
      "review": "Quand revoir le plan",
      "prepared": "J'ai retrouvé et ouvert la copie préparée",
      "checked": "J'ai déjà revu les informations du plan",
      "cadence": "Combien de jours entre les contrôles ?",
      "declaration": "Ce sont les étapes que vous déclarez, pas des contrôles effectués par AETERNA."
    },
    "help": {
      "role": "Choisissez une catégorie : proche, collègue, etc. Aucun nom n'est nécessaire ici.",
      "scope": "Choisissez une tâche précise, comme retrouver des copies. Cela ne donne pas accès à vos comptes.",
      "alternate": "Cochez si vous avez pensé à une seconde personne. La première peut ne pas répondre au bon moment.",
      "future": "Vous pouvez laisser “Pas encore décidé”. Exemple : discuter avant qu'une personne utilise votre voix dans un audio IA.",
      "memory": "Choisissez un souvenir à ranger dans vos outils : une photo à vous et deux lignes d'explication. Rien n'est chargé ici.",
      "prepared": "Cochez après avoir retrouvé et ouvert la copie. Choisir “Une photo” n'enregistre pas la photo.",
      "cadence": "30 jours, c'est environ une fois par mois. Choisissez un rythme possible. Ajoutez vous-même le rappel au calendrier.",
      "checked": "Cochez après un vrai contrôle. La date indique quand vous l'avez noté, pas que les informations sont toujours justes aujourd'hui."
    }
  },
  "es": {
    "ui": {
      "title": "Personas, recuerdos y próximas revisiones",
      "intro": "Prepara un pequeño paso cada vez. Elige solo el tipo de persona o ayuda. Nombres y contactos quedan en tus herramientas.",
      "roles": "¿Quién podría ayudarte?",
      "roleHelp": "Piensa en alguien con quien has hablado. Elige su papel, no su nombre. Ejemplo: un amigo que te ayuda a encontrar un documento.",
      "role": "¿Qué relación tienes con esta persona?",
      "scope": "¿En qué tarea podría ayudar?",
      "alternate": "He pensado en otra persona si falta la primera",
      "future": "Cómo quiero que se use mi voz o imagen",
      "memory": "Un recuerdo que guardar",
      "review": "Cuándo revisar el plan",
      "prepared": "He encontrado y abierto la copia preparada",
      "checked": "He revisado la información del plan",
      "cadence": "¿Cuántos días entre revisiones?",
      "declaration": "Son pasos que tú declaras, no controles realizados por AETERNA."
    },
    "help": {
      "role": "Elige una categoría, como familiar o colega. Aquí no hace falta el nombre.",
      "scope": "Elige una tarea clara, como encontrar copias. No da permiso para entrar en tus cuentas.",
      "alternate": "Marca si has pensado en una segunda persona. La primera podría no contestar cuando haga falta.",
      "future": "Puedes dejar “Todavía sin decidir”. Ejemplo: hablar antes de que alguien use tu voz en un audio de IA.",
      "memory": "Elige un recuerdo para ordenar en tus herramientas: una foto tuya y dos líneas de explicación. Aquí no se sube la foto.",
      "prepared": "Marca después de encontrar y abrir la copia. Elegir “Una foto” no guarda la foto.",
      "cadence": "30 días es más o menos una vez al mes. Elige un ritmo que puedas seguir y añade tú el recordatorio al calendario.",
      "checked": "Marca después de revisar de verdad. La fecha indica cuándo lo anotaste, no que la información siga siendo correcta hoy."
    }
  },
  "pt": {
    "ui": {
      "title": "Pessoas, memórias e próximas revisões",
      "intro": "Prepare um pequeno passo de cada vez. Escolha só o tipo de pessoa ou ajuda. Nomes e contactos ficam nas suas ferramentas.",
      "roles": "Quem poderia ajudar?",
      "roleHelp": "Pense numa pessoa com quem falou. Escolha o papel, não o nome. Exemplo: um amigo que ajuda a encontrar um documento.",
      "role": "Que relação tem com esta pessoa?",
      "scope": "Em que tarefa poderia ajudar?",
      "alternate": "Pensei noutra pessoa se a primeira faltar",
      "future": "Como quero que a minha voz ou imagem sejam usadas",
      "memory": "Uma memória para guardar",
      "review": "Quando rever o plano",
      "prepared": "Encontrei e abri a cópia preparada",
      "checked": "Já revi as informações do plano",
      "cadence": "Quantos dias entre revisões?",
      "declaration": "São passos que declara ter feito, não verificações feitas pela AETERNA."
    },
    "help": {
      "role": "Escolha uma categoria, como familiar ou colega. Não é preciso o nome aqui.",
      "scope": "Escolha uma tarefa clara, como encontrar cópias. Isto não dá acesso às suas contas.",
      "alternate": "Assinale se pensou numa segunda pessoa. A primeira pode não responder quando for preciso.",
      "future": "Pode deixar “Ainda não decidi”. Exemplo: conversar antes de alguém usar a sua voz num áudio de IA.",
      "memory": "Escolha uma memória para organizar nas suas ferramentas: uma fotografia sua e duas linhas de explicação. Não é carregada aqui.",
      "prepared": "Assinale depois de encontrar e abrir a cópia. Escolher “Uma fotografia” não guarda a fotografia.",
      "cadence": "30 dias é cerca de uma vez por mês. Escolha um ritmo possível e adicione o lembrete ao calendário.",
      "checked": "Assinale depois de verificar realmente. A data indica quando registou, não que a informação continue certa hoje."
    }
  }
};
for(const [lang,copy]of Object.entries(PLAIN_CARE))for(const [key,text]of Object.entries(copy.ui)){const index=keys.indexOf(key);if(index<0)throw Error('Unknown care copy key');rows[lang][index]=text;}
export const CARE_COPY=Object.freeze(Object.fromEntries(Object.keys(rows).map(lang=>[lang,{ui:Object.fromEntries(keys.map((k,i)=>[k,rows[lang][i]])),...categories[lang],help:PLAIN_CARE[lang].help}])));
export function createCarePanel({getPassport,updateCare,getLanguage,now,download,rerender=()=>{}}){
  let editing=null;
  const lang=()=>getLanguage(),cp=()=>CARE_COPY[lang()],u=k=>cp().ui[k],old=()=>EXTRA_COPY[lang()].ui;
  const button=(label,attrs='')=>`<button type="button" class="core-button" ${attrs}>${h(label)}</button>`;
  const helpKey=id=>({'care-role':'role','care-scope':'scope','care-memory':'memory','care-cadence':'cadence'}[id]||(id.startsWith('care-future-')?'future':null));
  const fieldHelp=(id,key=helpKey(id))=>key?`<p id="${h(id)}-help" class="core-small core-field-help">${h(cp().help[key])}</p>`:'';
  const select=(id,label,values,value,names)=>`<label for="${id}">${h(label)}</label><select id="${id}" aria-describedby="${id}-help">${values.map((v,i)=>`<option value="${h(v)}" ${v===value?'selected':''}>${h(names[i])}</option>`).join('')}</select>${fieldHelp(id)}`;
  const d=v=>v?new Intl.DateTimeFormat(lang(),{dateStyle:'medium'}).format(new Date(v)):u('unknown');
  function summary(){const p=getPassport();return `<details class="core-card"><summary>${h(u('overview'))}</summary><p>${h(u('declaration'))}</p><div class="core-progress-areas">${DIMENSIONS.map(id=>{const statuses=PHASES.filter(k=>PHASE_DIMENSIONS[k]===id).map(k=>effectivePhaseStatus(p.journey,k,now()));return `<article><h4>${h(CORE_COPY[lang()].dimensions[id])}</h4><p>${h(u('open'))}: ${statuses.filter(s=>s==='todo'||s==='declared').length} · ${h(u('recheck'))}: ${statuses.filter(s=>s==='review').length}</p></article>`;}).join('')}</div></details>`;}
  const alternateText=row=>row.alternate?u('alternate'):u('unknown');
  function records(care){return care.roles.map(row=>`<article class="core-record"><div><strong>${h(cp().roles[ROLE_TYPES.indexOf(row.role)])}</strong><p>${h(cp().scopes[ROLE_SCOPES.indexOf(row.scope)])}</p><p>${row.alternate?'✓ ':''}${h(alternateText(row))}</p></div><div>${button(old().edit,`data-care-edit="${row.id}"`)}${button(old().remove,`data-care-remove="${row.id}"`)}</div></article>`).join('');}
  function render(){const care=getPassport().care,row=care.roles.find(r=>r.id===editing)||{role:'relative',scope:'contacts',alternate:false};return `<div class="core-section-heading"><h3 id="core-view-title" tabindex="-1">${h(u('title'))}</h3><p>${h(u('intro'))}</p></div><section class="core-card"><h4>${h(u('roles'))}</h4><p>${h(u('roleHelp'))}</p>${records(care)}<form id="care-role-form">${select('care-role',u('role'),ROLE_TYPES,row.role,cp().roles)}${select('care-scope',u('scope'),ROLE_SCOPES,row.scope,cp().scopes)}<label class="core-check"><input id="care-alternate" type="checkbox" aria-describedby="care-alternate-help" ${row.alternate?'checked':''}>${h(u('alternate'))}</label>${fieldHelp('care-alternate','alternate')}<button type="submit" class="core-button core-primary">${h(old().saveItem)}</button></form><p class="core-note">${h(u('familyCheck'))}</p></section><details class="core-card"><summary>${h(u('future'))}</summary><p>${h(u('futureHelp'))}</p>${FUTURE_KEYS.map((k,i)=>select('care-future-'+k,cp().future[i],FUTURE_CHOICES,care.future[k],cp().choices)).join('')}</details><details class="core-card"><summary>${h(u('memory'))}</summary><p>${h(u('memoryHelp'))}</p><form id="care-memory-form">${select('care-memory',u('memory'),MEMORY_TOPICS,care.memory.topic,cp().memory)}<label class="core-check"><input id="care-prepared" type="checkbox" aria-describedby="care-prepared-help" ${care.memory.prepared?'checked':''}>${h(u('prepared'))}</label>${fieldHelp('care-prepared','prepared')}<p>${h(u('last'))}: ${h(d(care.memory.updatedAt))}</p><button type="submit" class="core-button">${h(old().saveItem)}</button></form></details><details class="core-card"><summary>${h(u('review'))}</summary><p>${h(u('reviewHelp'))}</p><form id="care-review-form">${select('care-cadence',u('cadence'),REVIEW_DAYS,care.review.cadenceDays,REVIEW_DAYS.map(v=>v+' '+u('days')))}<label class="core-check"><input id="care-checked" type="checkbox" aria-describedby="care-checked-help" ${care.review.lastCheckedAt?'checked':''}>${h(u('checked'))}</label>${fieldHelp('care-checked','checked')}<p>${h(u('last'))}: ${h(d(care.review.lastCheckedAt))}</p><button type="submit" class="core-button">${h(old().saveItem)}</button></form>${button(CORE_COPY[lang()].ui.downloadIcs,'data-export="calendar"')}</details><section class="core-card"><h4>${h(u('assist'))}</h4><p>${h(u('assistHelp'))}</p>${button(u('download'),'data-care-assistance')}<a class="core-button" href="mailto:info@aeternadigitallegacy.com?subject=AETERNA%20-%20richiesta%20assistenza">${h(u('mail'))}</a><p>${h(u('draftOnly'))}</p></section>`;}
  function printable(){
    const care=getPassport().care;
    return `<section><h2>${h(u('title'))}</h2><p>${h(u('roleHelp'))}</p><ul>${care.roles.map(r=>`<li>${h(cp().roles[ROLE_TYPES.indexOf(r.role)])}: ${h(cp().scopes[ROLE_SCOPES.indexOf(r.scope)])}. ${h(alternateText(r))}</li>`).join('')}</ul><h3>${h(u('future'))}</h3><p>${h(u('futureHelp'))}</p><ul>${FUTURE_KEYS.map((k,i)=>`<li>${h(cp().future[i])}: ${h(cp().choices[FUTURE_CHOICES.indexOf(care.future[k])])}</li>`).join('')}</ul><h3>${h(u('memory'))}</h3><p>${h(cp().memory[MEMORY_TOPICS.indexOf(care.memory.topic)])} · ${h(d(care.memory.updatedAt))}</p><p>${h(care.memory.prepared?u('prepared'):u('unknown'))}</p><p>${h(u('memoryHelp'))}</p><h3>${h(u('review'))}</h3><p>${care.review.cadenceDays} ${h(u('days'))} · ${h(u('last'))}: ${h(d(care.review.lastCheckedAt))}</p><p>${h(u('reviewHelp'))}</p></section>`;
  }
  function bind(root){
    root.querySelectorAll('[data-care-edit]').forEach(el=>el.onclick=()=>{editing=el.dataset.careEdit;rerender();});
    root.querySelectorAll('[data-care-remove]').forEach(el=>el.onclick=()=>{if(confirm(old().remove+'?'))updateCare(c=>removeRole(c,el.dataset.careRemove,now()));});
    const saveCurrentRole=finish=>{const row={id:editing||'item_'+crypto.randomUUID(),role:root.querySelector('#care-role').value,scope:root.querySelector('#care-scope').value,alternate:root.querySelector('#care-alternate').checked};editing=finish?null:row.id;updateCare(c=>saveRole(c,row,now()));};
    root.querySelector('#care-role-form')?.addEventListener('submit',e=>{e.preventDefault();saveCurrentRole(true);});
    root.querySelector('#care-role-form')?.addEventListener('change',()=>saveCurrentRole(false));
    FUTURE_KEYS.forEach(k=>root.querySelector('#care-future-'+k)?.addEventListener('change',e=>updateCare(c=>setFuture(c,k,e.target.value,now()))));
    const memoryChange=e=>{e.preventDefault();const topic=root.querySelector('#care-memory').value;let prepared=root.querySelector('#care-prepared').checked;if(e.target.id==='care-memory'&&topic!==getPassport().care.memory.topic)prepared=false;updateCare(c=>setMemory(c,topic,prepared,now()));};
    root.querySelector('#care-memory-form')?.addEventListener('submit',memoryChange);
    root.querySelector('#care-memory-form')?.addEventListener('change',memoryChange);
    const reviewChange=e=>{e.preventDefault();const cadence=Number(root.querySelector('#care-cadence').value),checked=root.querySelector('#care-checked').checked;updateCare(c=>{const updated=setReview(c,cadence,checked,now());if(checked&&c.review.lastCheckedAt&&e.target.id!=='care-checked')updated.review.lastCheckedAt=c.review.lastCheckedAt;return updated;});};
    root.querySelector('#care-review-form')?.addEventListener('submit',reviewChange);
    root.querySelector('#care-review-form')?.addEventListener('change',reviewChange);
    root.querySelector('[data-care-assistance]')?.addEventListener('click',()=>download('AETERNA-richiesta-assistenza.txt',[u('assist'),u('assistHelp'),u('draftOnly'),'info@aeternadigitallegacy.com'].join('\n\n'),'text/plain;charset=utf-8'));
  }
  return Object.freeze({render,bind,printable,summary,title:()=>u('title'),reset(){editing=null;}});
}
