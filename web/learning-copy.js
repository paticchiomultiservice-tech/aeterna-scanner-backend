// Plain explanations, not additional authorisations or a safety assessment.
const it={ui:{initial:'Parti con calma: non hai ancora una copia di questo percorso.',copyReady:'Questa pagina corrisponde alla copia caricata o confermata. Conservala con cura.',context:'Aiutaci a scegliere da dove iniziare',downloadAndStay:'Scarica la copia e resta qui per verificarla',invalidChoice:'Non è stato possibile aggiornare la scheda. Controlla le scelte e i limiti indicati.',glossary:'Le parole di questa pagina, spiegate in modo semplice',reviewDue:'La prova registrata risale ad almeno 90 giorni fa. Ti suggeriamo di ricontrollare: la data originale resta nel diario.',warningTitle:'Alternative da chiarire in questo scenario',noWarnings:'Nelle categorie registrate non emergono questi problemi. Non dimostra che il recupero funzionerà.',aiMeaning:'Leggere significa consultare dati. Una bozza è un testo da controllare, non ancora inviato. Un’azione esterna modifica qualcosa fuori da qui: per esempio invia un messaggio. Questa scheda annota la tua situazione, non dà permessi all’AI.'},states:{todo:'Non ho ancora preparato questo passaggio. Posso iniziare dalla guida, senza indovinare.',declared:'Ho preparato quanto descritto, ma non ho ancora provato che funzioni.',tested:'Ho fatto una prova sicura del passaggio. È una mia dichiarazione, non una verifica AETERNA.',review:'Qualcosa è cambiato o la prova è vecchia. Prima di fare affidamento sul piano devo ricontrollare.'},access:{unknown:'Va bene non saperlo. Apri le impostazioni ufficiali del servizio e cerca i metodi di accesso.',passkey:'Un accesso con una chiave custodita sul dispositivo o nel gestore scelto, spesso sbloccata con volto, impronta o PIN. Devi sapere come recuperarla.',password_mfa:'Oltre alla password serve un’altra conferma, per esempio da un’app o da una chiave di sicurezza.',password_only:'Hai indicato solo una password. Controlla se il servizio offre una seconda conferma.',provider:'Il servizio usa un altro metodo: verifica nelle sue istruzioni come entrare e recuperare l’accesso.'},recovery:{unknown:'Non indovinare: l’alternativa resta da trovare e verificare.',same_device:'Se perdi quel dispositivo, potresti perdere anche l’alternativa.',other_device:'Controlla che il secondo dispositivo sia utilizzabile senza dipendere da quello mancante.',offline:'Una copia separata, per esempio istruzioni su carta. Custodiscila con cura e non inserire qui i segreti.',trusted_contact:'Una persona configurata tramite una funzione ufficiale del servizio, non qualcuno a cui dire la password.',provider:'La procedura ufficiale aiuta a richiedere il recupero, ma non garantisce che riesca.'},delegationStates:{planned:'Devo ancora controllare nell’app quali permessi esistono.',declared:'Ho annotato ciò che ho controllato nell’app. AETERNA non lo ha verificato.',withdrawn:'Dichiaro di aver tolto il permesso nell’app. Selezionare questa voce non lo toglie automaticamente.'},warnings:{unknown:'Non hai ancora indicato un’alternativa: il risultato resta sconosciuto.',same_device:'L’alternativa dipende dallo stesso telefono che immagini di non avere.',trusted_contact:'L’alternativa dipende dalla persona che immagini non sia disponibile.',provider:'L’alternativa dipende dal fornitore/cloud coinvolto nello scenario: controlla le sue procedure.'},glossary:{cloud:'Uno spazio online in cui un fornitore conserva file o dati.',backup:'Una copia da ritrovare e aprire se l’originale non è disponibile.',referent:'Una persona che può aiutarti nei limiti concordati. Non riceve poteri da questa pagina.',permission:'Ciò che un’app o una persona può fare. Va verificato nel servizio che lo applica.',recovery:'I passaggi previsti dal fornitore per tornare a usare un account.'}};
const en={ui:{initial:'Start calmly: you do not yet have a copy of this journey.',copyReady:'This page matches the copy loaded or confirmed. Keep it safe.',context:'Help us choose where to start',downloadAndStay:'Download the copy and stay here to check it',invalidChoice:'The card could not be updated. Check the choices and limits shown.',glossary:'The words on this page, explained simply',reviewDue:'The recorded test is at least 90 days old. We suggest checking again; the original date stays in the diary.',warningTitle:'Alternatives to clarify in this scenario',noWarnings:'These issues do not appear in the recorded categories. This does not prove recovery will work.',aiMeaning:'Reading means consulting data. A draft is text to review, not yet sent. An external action changes something outside this page, such as sending a message. This card records your situation; it does not grant AI permissions.'},states:{todo:'I have not prepared this step yet. I can start with the guide rather than guess.',declared:'I have prepared what the guide describes, but have not tested whether it works.',tested:'I performed a safe test of this step. This is my declaration, not an AETERNA verification.',review:'Something changed or the test is old. I need to check again before relying on the plan.'},access:{unknown:'It is fine not to know. Open the official service settings and find its sign-in methods.',passkey:'Sign-in using a key kept on your device or chosen manager, often unlocked with face, fingerprint or PIN. Know how to recover it.',password_mfa:'Another confirmation is needed alongside the password, for example an app or security key.',password_only:'You recorded only a password. Check whether the service offers another confirmation.',provider:'The service uses another method: check its instructions for signing in and recovering access.'},recovery:{unknown:'Do not guess: the alternative still needs to be found and checked.',same_device:'Losing that device could also mean losing the alternative.',other_device:'Check that the second device can be used without depending on the missing one.',offline:'A separate copy, such as paper instructions. Store it carefully and do not enter secrets here.',trusted_contact:'Someone configured through an official service feature, not someone to give your password to.',provider:'The official procedure helps you request recovery; it does not guarantee success.'},delegationStates:{planned:'I still need to check which permissions exist in the app.',declared:'I recorded what I checked in the app. AETERNA has not verified it.',withdrawn:'I declare I removed permission in the app. Selecting this option does not remove it automatically.'},warnings:{unknown:'No alternative has been recorded: the result remains unknown.',same_device:'The alternative depends on the phone you imagine unavailable.',trusted_contact:'The alternative depends on the person you imagine unavailable.',provider:'The alternative depends on the provider/cloud in this scenario: check its procedures.'},glossary:{cloud:'Online space where a provider stores files or data.',backup:'A copy you can find and open when the original is unavailable.',referent:'Someone who can help within agreed limits. This page gives them no powers.',permission:'What an app or person may do. Check it in the service enforcing it.',recovery:'The steps a provider offers to regain use of an account.'}};
const fr={ui:{initial:'Commencez tranquillement : vous n’avez pas encore de copie de ce parcours.',copyReady:'Cette page correspond à la copie chargée ou confirmée. Conservez-la avec soin.',context:'Aidez-nous à choisir par où commencer',downloadAndStay:'Télécharger la copie et rester ici pour la vérifier',invalidChoice:'La fiche n’a pas pu être mise à jour. Vérifiez les choix et limites indiqués.',glossary:'Les mots de cette page expliqués simplement',reviewDue:'Le test enregistré date d’au moins 90 jours. Nous conseillons une nouvelle vérification ; la date originale reste au journal.',warningTitle:'Alternatives à clarifier dans ce scénario',noWarnings:'Ces problèmes ne ressortent pas des catégories enregistrées. Cela ne prouve pas que la récupération fonctionnera.',aiMeaning:'Lire signifie consulter des données. Un brouillon est un texte à vérifier, pas encore envoyé. Une action externe modifie quelque chose ailleurs, par exemple envoie un message. Cette fiche décrit votre situation ; elle ne donne aucun droit à l’IA.'},states:{todo:'Je n’ai pas encore préparé cette étape. Je peux commencer par le guide sans deviner.',declared:'J’ai préparé ce que décrit le guide, mais je n’ai pas encore testé son fonctionnement.',tested:'J’ai fait un test prudent de cette étape. C’est ma déclaration, pas une vérification AETERNA.',review:'Quelque chose a changé ou le test est ancien. Je dois vérifier avant de compter sur le plan.'},access:{unknown:'Vous pouvez ne pas savoir. Cherchez les méthodes de connexion dans les réglages officiels du service.',passkey:'Connexion avec une clé conservée sur votre appareil ou gestionnaire, souvent déverrouillée par visage, empreinte ou PIN. Vérifiez sa récupération.',password_mfa:'Une autre confirmation complète le mot de passe, par exemple une application ou clé de sécurité.',password_only:'Vous avez indiqué seulement un mot de passe. Vérifiez si le service propose une autre confirmation.',provider:'Le service utilise une autre méthode : consultez ses instructions de connexion et récupération.'},recovery:{unknown:'Ne devinez pas : il faut encore trouver et vérifier l’alternative.',same_device:'La perte de cet appareil peut aussi faire perdre l’alternative.',other_device:'Vérifiez que le second appareil fonctionne sans dépendre de celui qui manque.',offline:'Une copie séparée, par exemple sur papier. Gardez-la avec soin sans saisir de secrets ici.',trusted_contact:'Une personne configurée via une fonction officielle, pas quelqu’un à qui donner votre mot de passe.',provider:'La procédure officielle aide à demander la récupération, sans garantir le résultat.'},delegationStates:{planned:'Je dois encore vérifier les permissions dans l’application.',declared:'J’ai noté ce que j’ai vérifié dans l’application. AETERNA ne l’a pas vérifié.',withdrawn:'Je déclare avoir retiré la permission dans l’application. Ce choix ne la retire pas automatiquement.'},warnings:{unknown:'Aucune alternative indiquée : le résultat reste inconnu.',same_device:'L’alternative dépend du téléphone supposé indisponible.',trusted_contact:'L’alternative dépend de la personne supposée indisponible.',provider:'L’alternative dépend du fournisseur/cloud du scénario : vérifiez ses procédures.'},glossary:{cloud:'Un espace en ligne où un fournisseur conserve des fichiers ou données.',backup:'Une copie à retrouver et ouvrir si l’original manque.',referent:'Une personne qui aide dans les limites convenues. Cette page ne lui donne aucun pouvoir.',permission:'Ce qu’une application ou personne peut faire. Vérifiez dans le service qui applique la règle.',recovery:'Les étapes prévues par le fournisseur pour réutiliser un compte.'}};
const es={ui:{initial:'Empieza con calma: todavía no tienes una copia de este recorrido.',copyReady:'Esta página coincide con la copia cargada o confirmada. Consérvala con cuidado.',context:'Ayúdanos a elegir por dónde empezar',downloadAndStay:'Descargar la copia y quedarme para comprobarla',invalidChoice:'No se pudo actualizar la ficha. Revisa las opciones y límites indicados.',glossary:'Las palabras de esta página, explicadas con sencillez',reviewDue:'La prueba registrada tiene al menos 90 días. Recomendamos revisarla; la fecha original permanece en el diario.',warningTitle:'Alternativas que aclarar en este escenario',noWarnings:'Estos problemas no aparecen en las categorías registradas. No demuestra que la recuperación funcionará.',aiMeaning:'Leer es consultar datos. Un borrador es texto para revisar, todavía no enviado. Una acción externa cambia algo fuera de aquí, por ejemplo envía un mensaje. Esta ficha anota tu situación; no concede permisos a la IA.'},states:{todo:'Todavía no he preparado este paso. Puedo empezar con la guía sin adivinar.',declared:'He preparado lo que describe la guía, pero no he probado que funcione.',tested:'He hecho una prueba segura de este paso. Es mi declaración, no una verificación AETERNA.',review:'Algo cambió o la prueba es antigua. Debo revisar antes de confiar en el plan.'},access:{unknown:'Está bien no saberlo. Busca los métodos de acceso en los ajustes oficiales del servicio.',passkey:'Acceso con una clave guardada en tu dispositivo o gestor, a menudo desbloqueada con rostro, huella o PIN. Comprueba cómo recuperarla.',password_mfa:'Además de la contraseña se necesita otra confirmación, por ejemplo una app o llave de seguridad.',password_only:'Has indicado solo una contraseña. Comprueba si el servicio ofrece otra confirmación.',provider:'El servicio usa otro método: consulta sus instrucciones de acceso y recuperación.'},recovery:{unknown:'No adivines: todavía hay que encontrar y comprobar la alternativa.',same_device:'Si pierdes ese dispositivo, también podrías perder la alternativa.',other_device:'Comprueba que el segundo dispositivo funciona sin depender del que falta.',offline:'Una copia separada, por ejemplo instrucciones en papel. Guárdala con cuidado sin introducir secretos aquí.',trusted_contact:'Una persona configurada con una función oficial, no alguien a quien dar la contraseña.',provider:'El procedimiento oficial permite solicitar recuperación; no garantiza el resultado.'},delegationStates:{planned:'Todavía debo comprobar los permisos en la app.',declared:'He anotado lo que comprobé en la app. AETERNA no lo ha verificado.',withdrawn:'Declaro que retiré el permiso en la app. Esta opción no lo retira automáticamente.'},warnings:{unknown:'No has indicado una alternativa: el resultado sigue siendo desconocido.',same_device:'La alternativa depende del teléfono que imaginas no disponible.',trusted_contact:'La alternativa depende de la persona que imaginas no disponible.',provider:'La alternativa depende del proveedor/cloud del escenario: revisa sus procedimientos.'},glossary:{cloud:'Un espacio en línea donde un proveedor guarda archivos o datos.',backup:'Una copia que puedas encontrar y abrir si falta el original.',referent:'Una persona que ayuda dentro de los límites acordados. Esta página no le da poderes.',permission:'Lo que una app o persona puede hacer. Compruébalo en el servicio que lo aplica.',recovery:'Los pasos previstos por el proveedor para volver a usar una cuenta.'}};
const pt={ui:{initial:'Comece com calma: ainda não tem uma cópia deste percurso.',copyReady:'Esta página corresponde à cópia carregada ou confirmada. Guarde-a com cuidado.',context:'Ajude-nos a escolher por onde começar',downloadAndStay:'Descarregar a cópia e ficar para a verificar',invalidChoice:'Não foi possível atualizar a ficha. Verifique as escolhas e limites indicados.',glossary:'As palavras desta página explicadas de forma simples',reviewDue:'O teste registado tem pelo menos 90 dias. Sugerimos uma nova verificação; a data original fica no diário.',warningTitle:'Alternativas a esclarecer neste cenário',noWarnings:'Estes problemas não aparecem nas categorias registadas. Isso não prova que a recuperação funcionará.',aiMeaning:'Ler significa consultar dados. Um rascunho é texto para rever, ainda não enviado. Uma ação externa muda algo fora desta página, por exemplo envia uma mensagem. Esta ficha regista a situação; não dá permissões à IA.'},states:{todo:'Ainda não preparei este passo. Posso começar pelo guia sem adivinhar.',declared:'Preparei o que o guia descreve, mas ainda não testei se funciona.',tested:'Fiz um teste seguro deste passo. É uma declaração minha, não uma verificação AETERNA.',review:'Algo mudou ou o teste é antigo. Preciso de rever antes de confiar no plano.'},access:{unknown:'Não faz mal não saber. Procure os métodos de acesso nas definições oficiais do serviço.',passkey:'Acesso com uma chave no dispositivo ou gestor escolhido, muitas vezes desbloqueada com rosto, impressão digital ou PIN. Saiba como recuperá-la.',password_mfa:'Além da palavra-passe é necessária outra confirmação, por exemplo uma app ou chave de segurança.',password_only:'Indicou apenas uma palavra-passe. Verifique se o serviço permite outra confirmação.',provider:'O serviço usa outro método: consulte as instruções de acesso e recuperação.'},recovery:{unknown:'Não adivinhe: ainda é preciso encontrar e verificar a alternativa.',same_device:'Se perder esse dispositivo, poderá perder também a alternativa.',other_device:'Verifique que o segundo dispositivo funciona sem depender do que falta.',offline:'Uma cópia separada, por exemplo instruções em papel. Guarde-a com cuidado sem inserir segredos aqui.',trusted_contact:'Uma pessoa configurada por uma função oficial, não alguém a quem dar a palavra-passe.',provider:'O procedimento oficial ajuda a pedir recuperação; não garante o resultado.'},delegationStates:{planned:'Ainda tenho de verificar as permissões na app.',declared:'Registei o que verifiquei na app. AETERNA não o verificou.',withdrawn:'Declaro que retirei a permissão na app. Esta opção não a retira automaticamente.'},warnings:{unknown:'Não indicou uma alternativa: o resultado continua desconhecido.',same_device:'A alternativa depende do telefone que imagina indisponível.',trusted_contact:'A alternativa depende da pessoa que imagina indisponível.',provider:'A alternativa depende do fornecedor/cloud do cenário: verifique os procedimentos.'},glossary:{cloud:'Um espaço online onde um fornecedor guarda ficheiros ou dados.',backup:'Uma cópia que possa encontrar e abrir se faltar o original.',referent:'Uma pessoa que ajuda dentro dos limites acordados. Esta página não lhe dá poderes.',permission:'O que uma app ou pessoa pode fazer. Verifique no serviço que aplica a regra.',recovery:'Os passos previstos pelo fornecedor para voltar a usar uma conta.'}};
const questions={it:'A che punto sei con questo passaggio?',en:'How far have you got with this step?',fr:'Où en êtes-vous à cette étape ?',es:'¿En qué punto estás con este paso?',pt:'Em que ponto está neste passo?'};
const terms={it:{cloud:'Cloud',backup:'Copia di riserva',referent:'Persona di fiducia',permission:'Permesso',recovery:'Recupero dell’accesso'},en:{cloud:'Cloud',backup:'Backup',referent:'Trusted person',permission:'Permission',recovery:'Account recovery'},fr:{cloud:'Cloud',backup:'Copie de secours',referent:'Personne de confiance',permission:'Permission',recovery:'Récupération du compte'},es:{cloud:'Nube',backup:'Copia de seguridad',referent:'Persona de confianza',permission:'Permiso',recovery:'Recuperación de acceso'},pt:{cloud:'Nuvem',backup:'Cópia de segurança',referent:'Pessoa de confiança',permission:'Permissão',recovery:'Recuperação de acesso'}};
for(const [lang,c]of Object.entries({it,en,fr,es,pt})){c.ui.stateQuestion=questions[lang];c.terms=terms[lang];}
// Plain-language field guidance. No new permissions or data fields.
const PLAIN_FORMS={
  "it": {
    "inventory": {
      "serviceLabel": "Quale servizio vuoi preparare?",
      "serviceHelp": "Scegli il tipo di servizio. Esempio: per la tua posta scegli “Email principale”. Qui non scrivere indirizzi o password.",
      "accessLabel": "Come entri di solito?",
      "accessHelp": "Pensa all'ultima volta che hai aperto quel servizio. Hai usato una password, una chiave di accesso o anche un codice? Se non ricordi, scegli “Non lo so ancora”.",
      "recoveryLabel": "Se non riesci più a entrare, che altra strada hai?",
      "recoveryHelp": "Indica dove troveresti aiuto. Esempio: un altro telefono che puoi aprire senza quello perso. Scrivi solo il tipo di alternativa, mai i codici.",
      "testedLabel": "Ho già provato questa strada",
      "testedHelp": "Spunta solo se hai fatto davvero una prova e sai quale servizio riguardava. Se hai solo letto le istruzioni o non sei sicuro, lascia vuoto.",
      "saveHelp": "Le scelte restano in questa pagina. Per ritrovarle dopo, salva il Passaporto o attiva il salvataggio nel profilo quando disponibile.",
      "startExample": "Esempio: parto dalla mia email. Scelgo come entro e dove troverei aiuto se perdessi il telefono. Non devo conoscere tutto subito."
    },
    "ai": {
      "agentHelp": "Scegli l'app che usi, per esempio ChatGPT. Se non c'è nell'elenco, scegli “Altro servizio”.",
      "purposeHelp": "Scegli per che cosa la usi: vita personale, famiglia, lavoro o attività creativa.",
      "readHelp": "Leggere: vedere informazioni. Spunta solo se hai controllato nell'app che questo uso sia consentito.",
      "draftHelp": "Preparare una bozza: scrivere qualcosa che tu leggi prima di usarlo. Non significa inviare il testo.",
      "actionHelp": "Agire fuori dall'app: per esempio inviare un messaggio o modificare un file. Controlla il permesso nel servizio originale.",
      "confirmationHelp": "Prima di un'azione importante deve intervenire una persona. Questa scheda non applica da sola quel controllo.",
      "untilHelp": "Facoltativo. Indica quando vorresti ricontrollare o terminare l'aiuto. La data qui non fa scadere un permesso nell'app.",
      "stateHelp": "Se non hai ancora controllato l'app, scegli “Da controllare”. Annota una revoca solo dopo averla eseguita nel servizio originale."
    },
    "protocol": {
      "stateHelp": "Scegli ciò che hai fatto davvero. “Preparato” significa che hai organizzato il necessario. “Provato” significa che hai anche fatto una prova. Se non sai, parti da “Da fare”."
    },
    "concepts": {
      "passport": "Il Passaporto è il tuo elenco di istruzioni: che cosa usi, come entri e chi può aiutarti.",
      "capsule": "La Capsula è una scheda breve da portare con te o stampare. Chi la trova può leggere i dati che scegli di mostrarci.",
      "phone": "“Domani senza telefono” è una prova guidata sulla carta: immagini di non avere il telefono e controlli quali alternative hai.",
      "cards": "Una scheda di continuità riguarda un servizio alla volta, per esempio la posta. Non contiene la password.",
      "next": "Parti da un servizio importante. Se una domanda è difficile, scegli “Non lo so ancora” e torna dopo: non devi indovinare."
    }
  },
  "en": {
    "inventory": {
      "serviceLabel": "Which service do you want to prepare?",
      "serviceHelp": "Choose the type of service. For your email, choose “Main email”. Do not enter addresses or passwords here.",
      "accessLabel": "How do you usually sign in?",
      "accessHelp": "Think about the last time you opened this service. Did you use a password, a passkey or another code too? Choose “I do not know yet” if unsure.",
      "recoveryLabel": "If you cannot sign in, what other route do you have?",
      "recoveryHelp": "Choose where you would find help. For example: another phone you can unlock without the lost one. Record the type of alternative, never the codes.",
      "testedLabel": "I have already tried this route",
      "testedHelp": "Tick only after a real test for this service. Leave it unticked if you only read the instructions or are unsure.",
      "saveHelp": "Choices stay in this page. To find them later, save the Passport or turn on profile saving when available.",
      "startExample": "Example: start with your email. Choose how you sign in and where you would find help after losing your phone. You do not need every answer now."
    },
    "ai": {
      "agentHelp": "Choose the app you use, such as ChatGPT. If it is not listed, choose “Other service”.",
      "purposeHelp": "Choose what you use it for: personal life, family, work or creative activity.",
      "readHelp": "Read: see information. Tick only if you checked in the app that this use is allowed.",
      "draftHelp": "Prepare a draft: write something for you to review. This does not mean sending it.",
      "actionHelp": "Act outside the app: for example send a message or change a file. Check the permission in the original service.",
      "confirmationHelp": "A person must step in before an important action. This card does not enforce that check.",
      "untilHelp": "Optional. Choose when you want to review or end the help. A date here does not expire a permission in the app.",
      "stateHelp": "Choose “To check” if you have not checked the app. Record removal only after removing permission in the original service."
    },
    "protocol": {
      "stateHelp": "Choose what you actually did. “Prepared” means you organised what is needed. “Tried” means you also ran a test. Start with “To do” if unsure."
    },
    "concepts": {
      "passport": "The Passport is your instruction list: what you use, how you sign in and who may help.",
      "capsule": "The Capsule is a short card to carry or print. Anyone finding it can read the details you choose to show.",
      "phone": "“Without my phone” is a guided paper exercise: imagine the phone is missing and check your other routes.",
      "cards": "Each continuity card covers one service, such as email. It does not hold your password.",
      "next": "Start with one important service. If a question is difficult, choose “I do not know yet” and return later. Do not guess."
    }
  },
  "fr": {
    "inventory": {
      "serviceLabel": "Quel service voulez-vous préparer ?",
      "serviceHelp": "Choisissez le type de service. Pour votre messagerie, choisissez “E-mail principal”. Ne saisissez ni adresse ni mot de passe ici.",
      "accessLabel": "Comment vous connectez-vous d'habitude ?",
      "accessHelp": "Pensez à la dernière connexion : mot de passe, clé d'accès ou code supplémentaire ? Choisissez “Je ne sais pas encore” si vous hésitez.",
      "recoveryLabel": "Si la connexion ne marche plus, quelle autre solution avez-vous ?",
      "recoveryHelp": "Indiquez où trouver de l'aide. Exemple : un autre téléphone que vous pouvez ouvrir sans celui qui manque. Notez le type de solution, jamais les codes.",
      "testedLabel": "J'ai déjà essayé cette solution",
      "testedHelp": "Cochez seulement après un vrai essai pour ce service. Laissez vide si vous avez seulement lu les instructions ou si vous hésitez.",
      "saveHelp": "Les choix restent dans cette page. Pour les retrouver plus tard, enregistrez le Passeport ou activez l'enregistrement dans le profil si disponible.",
      "startExample": "Exemple : commencez par votre messagerie. Choisissez comment vous entrez et où trouver de l'aide sans votre téléphone. Toutes les réponses ne sont pas nécessaires maintenant."
    },
    "ai": {
      "agentHelp": "Choisissez l'application utilisée, par exemple ChatGPT. Si elle manque, choisissez “Autre service”.",
      "purposeHelp": "Choisissez son usage : vie personnelle, famille, travail ou création.",
      "readHelp": "Lire : voir des informations. Cochez seulement après avoir vérifié cette permission dans l'application.",
      "draftHelp": "Préparer un brouillon : écrire un texte que vous vérifiez. Cela ne signifie pas l'envoyer.",
      "actionHelp": "Agir ailleurs : envoyer un message ou modifier un fichier, par exemple. Vérifiez la permission dans le service d'origine.",
      "confirmationHelp": "Une personne doit intervenir avant une action importante. Cette fiche n'impose pas ce contrôle.",
      "untilHelp": "Facultatif. Indiquez quand revoir ou terminer l'aide. La date inscrite ici ne fait pas expirer une permission dans l'application.",
      "stateHelp": "Choisissez “À vérifier” si vous n'avez pas contrôlé l'application. Notez un retrait seulement après l'avoir fait dans le service d'origine."
    },
    "protocol": {
      "stateHelp": "Choisissez ce que vous avez vraiment fait. “Préparé” signifie avoir organisé le nécessaire. “Essayé” signifie avoir fait aussi un essai. Si vous hésitez, commencez par “À faire”."
    },
    "concepts": {
      "passport": "Le Passeport est votre liste d'instructions : ce que vous utilisez, comment vous entrez et qui peut aider.",
      "capsule": "La Capsule est une fiche courte à emporter ou imprimer. Toute personne qui la trouve peut lire les détails que vous choisissez.",
      "phone": "“Sans mon téléphone” est un exercice guidé sur papier : imaginez le téléphone absent et cherchez les autres solutions.",
      "cards": "Chaque fiche de continuité concerne un service, comme la messagerie. Elle ne contient pas votre mot de passe.",
      "next": "Commencez par un service important. Si une question est difficile, choisissez “Je ne sais pas encore” et revenez plus tard, sans deviner."
    }
  },
  "es": {
    "inventory": {
      "serviceLabel": "¿Qué servicio quieres preparar?",
      "serviceHelp": "Elige el tipo de servicio. Para tu correo, elige “Correo principal”. No escribas direcciones ni contraseñas aquí.",
      "accessLabel": "¿Cómo entras normalmente?",
      "accessHelp": "Piensa en la última vez: ¿usaste una contraseña, una clave de acceso o también otro código? Elige “Todavía no lo sé” si dudas.",
      "recoveryLabel": "Si no puedes entrar, ¿qué otra opción tienes?",
      "recoveryHelp": "Indica dónde buscarías ayuda. Por ejemplo: otro teléfono que puedes abrir sin el perdido. Anota el tipo de alternativa, nunca los códigos.",
      "testedLabel": "Ya he probado esta opción",
      "testedHelp": "Marca solo después de una prueba real de este servicio. Déjalo sin marcar si solo leíste las instrucciones o no estás seguro.",
      "saveHelp": "Las opciones quedan en esta página. Para encontrarlas después, guarda el Pasaporte o activa el guardado en el perfil cuando esté disponible.",
      "startExample": "Ejemplo: empieza por tu correo. Elige cómo entras y dónde buscarías ayuda sin tu teléfono. No necesitas saberlo todo ahora."
    },
    "ai": {
      "agentHelp": "Elige la app que usas, por ejemplo ChatGPT. Si no aparece, elige “Otro servicio”.",
      "purposeHelp": "Elige para qué la usas: vida personal, familia, trabajo o creación.",
      "readHelp": "Leer: ver información. Marca solo si has comprobado este permiso en la app.",
      "draftHelp": "Preparar un borrador: escribir algo que tú revisas. No significa enviarlo.",
      "actionHelp": "Actuar fuera de la app: enviar un mensaje o cambiar un archivo, por ejemplo. Comprueba el permiso en el servicio original.",
      "confirmationHelp": "Una persona debe intervenir antes de una acción importante. Esta ficha no aplica ese control.",
      "untilHelp": "Opcional. Indica cuándo quieres revisar o terminar la ayuda. Esta fecha no hace caducar un permiso de la app.",
      "stateHelp": "Elige “Por comprobar” si no revisaste la app. Anota una retirada solo después de hacerla en el servicio original."
    },
    "protocol": {
      "stateHelp": "Elige lo que has hecho de verdad. “Preparado” significa organizar lo necesario. “Probado” significa hacer también una prueba. Si dudas, empieza por “Por hacer”."
    },
    "concepts": {
      "passport": "El Pasaporte es tu lista de instrucciones: qué usas, cómo entras y quién puede ayudar.",
      "capsule": "La Cápsula es una ficha breve para llevar o imprimir. Quien la encuentre puede leer los datos que eliges mostrar.",
      "phone": "“Sin mi teléfono” es un ejercicio guiado sobre papel: imagina que falta y busca otras opciones.",
      "cards": "Cada ficha de continuidad trata un servicio, como el correo. No contiene tu contraseña.",
      "next": "Empieza por un servicio importante. Si una pregunta es difícil, elige “Todavía no lo sé” y vuelve después. No adivines."
    }
  },
  "pt": {
    "inventory": {
      "serviceLabel": "Que serviço quer preparar?",
      "serviceHelp": "Escolha o tipo de serviço. Para o seu email, escolha “E-mail principal”. Não escreva endereços nem palavras-passe aqui.",
      "accessLabel": "Como entra normalmente?",
      "accessHelp": "Pense na última vez: usou palavra-passe, chave de acesso ou também outro código? Escolha “Ainda não sei” se tiver dúvidas.",
      "recoveryLabel": "Se não conseguir entrar, que outra opção tem?",
      "recoveryHelp": "Indique onde encontraria ajuda. Exemplo: outro telefone que pode abrir sem o perdido. Registe o tipo de alternativa, nunca os códigos.",
      "testedLabel": "Já experimentei esta opção",
      "testedHelp": "Assinale só depois de um teste real deste serviço. Deixe por assinalar se apenas leu as instruções ou tem dúvidas.",
      "saveHelp": "As escolhas ficam nesta página. Para as encontrar depois, guarde o Passaporte ou ative a gravação no perfil quando disponível.",
      "startExample": "Exemplo: comece pelo email. Escolha como entra e onde encontraria ajuda sem o telefone. Não precisa de saber tudo agora."
    },
    "ai": {
      "agentHelp": "Escolha a app que usa, por exemplo ChatGPT. Se não aparecer, escolha “Outro serviço”.",
      "purposeHelp": "Escolha para que a usa: vida pessoal, família, trabalho ou criação.",
      "readHelp": "Ler: ver informações. Assinale só se verificou esta permissão na app.",
      "draftHelp": "Preparar um rascunho: escrever algo que irá rever. Não significa enviá-lo.",
      "actionHelp": "Agir fora da app: enviar uma mensagem ou alterar um ficheiro, por exemplo. Verifique a permissão no serviço original.",
      "confirmationHelp": "Uma pessoa deve intervir antes de uma ação importante. Esta ficha não aplica esse controlo.",
      "untilHelp": "Opcional. Indique quando quer rever ou terminar a ajuda. Esta data não faz expirar uma permissão da app.",
      "stateHelp": "Escolha “Por verificar” se não reviu a app. Registe uma retirada só depois de a fazer no serviço original."
    },
    "protocol": {
      "stateHelp": "Escolha o que fez realmente. “Preparado” significa organizar o necessário. “Testado” significa fazer também um teste. Em caso de dúvida, comece por “Por fazer”."
    },
    "concepts": {
      "passport": "O Passaporte é a sua lista de instruções: o que usa, como entra e quem pode ajudar.",
      "capsule": "A Cápsula é uma ficha curta para levar ou imprimir. Quem a encontrar pode ler os dados que escolhe mostrar.",
      "phone": "“Sem o meu telefone” é um exercício guiado em papel: imagine que falta e procure outras opções.",
      "cards": "Cada ficha de continuidade trata um serviço, como o email. Não contém a sua palavra-passe.",
      "next": "Comece por um serviço importante. Se uma pergunta for difícil, escolha “Ainda não sei” e volte depois. Não adivinhe."
    }
  }
};
for(const [lang,copy]of Object.entries({it,en,fr,es,pt}))copy.forms=PLAIN_FORMS[lang];
export const LEARNING_COPY=Object.freeze({it,en,fr,es,pt});
