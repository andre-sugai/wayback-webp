import React, { useState, useEffect } from 'react';
import { 
  History, Search, ExternalLink, Calendar, 
  Layers, Loader2, AlertCircle, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown
} from 'lucide-react';

interface Snapshot {
  timestamp: string;
  originalUrl: string;
  archiveUrl: string;
  dateFormatted: string;
  statusCode: string;
}

const ITEMS_PER_PAGE = 10;

const TIME_QUOTES = [
  // Clássicos Brasileiros
  { text: "O tempo é um tecido invisível em que se pode bordar tudo.", author: "Machado de Assis" },
  { text: "O tempo é o senhor da razão.", author: "Provérbio Português" },
  { text: "Não tentes deter o rio do tempo.", author: "Lao Tsé" },
  { text: "O tempo voa sobre nós, mas deixa a sua sombra para trás.", author: "Nathaniel Hawthorne" },
  { text: "O futuro tem muitos nomes. Para os fracos, é o inalcançável. Para os temerosos, o desconhecido. Para os valentes, é a oportunidade.", author: "Victor Hugo" },
  { text: "Perder tempo em aprender coisas que não interessam, priva-nos de descobrir coisas interessantes.", author: "Carlos Drummond de Andrade" },
  { text: "O que importa afinal, viver ou saber que se está vivendo?", author: "Clarice Lispector" },
  { text: "A vida é o que acontece enquanto você está ocupado fazendo outros planos.", author: "John Lennon" },
  { text: "O tempo não para, só a saudade é que faz as coisas pararem no tempo.", author: "Mario Quintana" },
  { text: "Não existe o esquecimento total: as pegadas, uma vez impressas na alma, são indestrutíveis.", author: "Thomas De Quincey" },
  
  // Filósofos e Pensadores Antigos
  { text: "O tempo dura bastante para aqueles que sabem aproveitá-lo.", author: "Leonardo da Vinci" },
  { text: "Não é que tenhamos pouco tempo, mas desperdiçamos muito.", author: "Sêneca" },
  { text: "Tudo flui, nada permanece.", author: "Heráclito" },
  { text: "O tempo é a imagem móvel da eternidade imóvel.", author: "Platão" },
  { text: "O homem que tem coragem de desperdiçar uma hora do seu tempo não descobriu o valor da vida.", author: "Charles Darwin" },
  { text: "A brevidade da vida proíbe-nos de alimentar esperanças longas.", author: "Horácio" },
  { text: "O tempo revela a verdade.", author: "Sêneca" },
  { text: "Aquele que não tem tempo para cuidar da saúde terá que arranjar tempo para cuidar da doença.", author: "Provérbio Chinês" },
  { text: "A paciência é amarga, mas seu fruto é doce.", author: "Jean-Jacques Rousseau" },
  { text: "O tempo é o mais sábio de todos os conselheiros.", author: "Péricles" },
  
  // Ciência e Modernidade
  { text: "O tempo é relativo e único para cada observador.", author: "Albert Einstein" },
  { text: "O tempo é uma ilusão. O tempo do almoço é duplamente uma ilusão.", author: "Douglas Adams" },
  { text: "Nós nunca somos os mesmos, nem o mundo à nossa volta.", author: "Carl Sagan" },
  { text: "O passado é apenas uma história que contamos a nós mesmos.", author: "Spike Jonze" },
  { text: "Se você quer conhecer o passado, olhe para o seu presente. Se quer conhecer o futuro, olhe para o seu presente.", author: "Buda" },
  { text: "O tempo é a moeda da sua vida. É a única moeda que você tem, e somente você pode determinar como ela será gasta.", author: "Carl Sandburg" },
  { text: "Não tenho tempo para não ter tempo.", author: "Coco Chanel" },
  { text: "Tudo o que temos de decidir é o que fazer com o tempo que nos é dado.", author: "J.R.R. Tolkien" },
  { text: "O tempo é o melhor autor; sempre encontra um final perfeito.", author: "Charles Chaplin" },
  
  // Literatura e Arte
  { text: "O tempo é um grande mestre, mas infelizmente mata todos os seus alunos.", author: "Hector Berlioz" },
  { text: "Memória é o que sobra quando tudo acontece.", author: "Millôr Fernandes" },
  { text: "Há um tempo para partir, mesmo quando não há um lugar certo para ir.", author: "Tennessee Williams" },
  { text: "O tempo é muito lento para os que esperam, muito rápido para os que têm medo, muito longo para os que lamentam, muito curto para os que festejam, mas, para os que amam, o tempo é eterno.", author: "Henry Van Dyke" },
  { text: "A saudade é a nossa alma dizendo para onde ela quer voltar.", author: "Rubem Alves" },
  { text: "Recordar é fácil para quem tem memória. Esquecer é difícil para quem tem coração.", author: "Gabriel García Márquez" },
  { text: "O tempo não cura tudo. Aliás, o tempo não cura nada, o tempo apenas tira o incurável do centro das atenções.", author: "Martha Medeiros" },
  { text: "A história é um conjunto de mentiras sobre as quais se chegou a um acordo.", author: "Napoleão Bonaparte" },
  
  // Sabedoria Popular e Provérbios
  { text: "Antes tarde do que nunca.", author: "Dito Popular" },
  { text: "O tempo é remédio.", author: "Dito Popular" },
  { text: "Águas passadas não movem moinhos.", author: "Provérbio Popular" },
  { text: "Devagar se vai ao longe.", author: "Dito Popular" },
  { text: "A pressa é inimiga da perfeição.", author: "Dito Popular" },
  { text: "Quem tem pressa come cru.", author: "Dito Popular" },
  { text: "Não deixe para amanhã o que você pode fazer hoje.", author: "Dito Popular" },
  { text: "O tempo ensina, o tempo cura, o tempo traz a verdade.", author: "Anônimo" },
  
  // Reflexões sobre o Digital e o Eterno
  { text: "A internet não esquece, mas o Wayback Machine lembra.", author: "Anônimo" },
  { text: "O código é poesia escrita para máquinas.", author: "Anônimo" },
  { text: "Nada se perde na rede, tudo se transforma em dados.", author: "Anônimo" },
  { text: "Arquivar a web é preservar a memória da humanidade digital.", author: "Internet Archive" },
  { text: "Um site antigo é uma janela para quem fomos.", author: "Anônimo" },
  
  // Mais Filósofos
  { text: "Só sei que nada sei.", author: "Sócrates" },
  { text: "A vida sem exame não vale a pena ser vivida.", author: "Sócrates" },
  { text: "Onde há vida, há esperança.", author: "Teócrito" },
  { text: "A alegria evita mil males e prolonga a vida.", author: "William Shakespeare" },
  { text: "Nossas dúvidas são traidoras e nos fazem perder o que, com frequência, poderíamos ganhar, por simples medo de arriscar.", author: "William Shakespeare" },
  { text: "Lamentar uma dor passada é criar outra dor e sofrer novamente.", author: "William Shakespeare" },
  { text: "O tempo é o correio da vida; ele trará tudo a você.", author: "Provérbio Russo" },
  { text: "Não conte os dias, faça os dias contarem.", author: "Muhammad Ali" },
  
  // Variações e Outros
  { text: "A melhor maneira de prever o futuro é criá-lo.", author: "Peter Drucker" },
  { text: "Sempre parece impossível até que seja feito.", author: "Nelson Mandela" },
  { text: "O sucesso é ir de fracasso em fracasso sem perder o entusiasmo.", author: "Winston Churchill" },
  { text: "A história será gentil comigo, pois pretendo escrevê-la.", author: "Winston Churchill" },
  { text: "Seja a mudança que você quer ver no mundo.", author: "Mahatma Gandhi" },
  { text: "A vida é uma peça de teatro que não permite ensaios.", author: "Charles Chaplin" },
  { text: "Um dia sem rir é um dia desperdiçado.", author: "Charles Chaplin" },
  { text: "Pense globalmente, aja localmente.", author: "Patrick Geddes" },
  { text: "A simplicidade é o último grau de sofisticação.", author: "Leonardo da Vinci" },
  { text: "Aprender é a única coisa de que a mente nunca se cansa, nunca tem medo e nunca se arrepende.", author: "Leonardo da Vinci" },
  { text: "Quem não compreende um olhar, tampouco compreenderá uma longa explicação.", author: "Mário Quintana" },
  { text: "O tempo não espera por ninguém.", author: "Folclore" },
  { text: "Cada segundo é tempo para mudar tudo para sempre.", author: "Charles Chaplin" },
  { text: "O agora é o único momento que possuímos.", author: "Eckhart Tolle" },
  { text: "O passado não pode ser mudado. O futuro ainda está em seu poder.", author: "Mary Pickford" },
  { text: "Você nunca é velho demais para definir outra meta ou sonhar um novo sonho.", author: "C.S. Lewis" },
  { text: "A única maneira de fazer um excelente trabalho é amar o que você faz.", author: "Steve Jobs" },
  { text: "O tempo é limitado, então não o perca vivendo a vida de outra pessoa.", author: "Steve Jobs" },
  { text: "Fique faminto, fique tolo.", author: "Steve Jobs" },
  { text: "A inovação distingue um líder de um seguidor.", author: "Steve Jobs" },
  { text: "Não espere. O tempo nunca será o 'certo'.", author: "Napoleon Hill" },
  { text: "Tudo acontece a todos, mais cedo ou mais tarde, se houver tempo suficiente.", author: "George Bernard Shaw" },
  { text: "A juventude é um presente da natureza, mas a idade é uma obra de arte.", author: "Stanislaw Lec" },
  { text: "A vida deve ser vivida para a frente, mas só pode ser compreendida para trás.", author: "Søren Kierkegaard" },
  { text: "Caminhante, não há caminho, o caminho se faz ao andar.", author: "Antonio Machado" },
  { text: "O tempo não volta, mas a memória o recria.", author: "Anônimo" },
  { text: "A nostalgia é a prova de que o passado valeu a pena.", author: "Anônimo" },
  { text: "Hoje é o amanhã com o qual você se preocupou ontem.", author: "Dale Carnegie" },
  { text: "A procrastinação é a ladra do tempo.", author: "Edward Young" },
  { text: "O tempo amadurece todas as coisas. Nenhum homem nasce sábio.", author: "Cervantes" },
  { text: "A história é a testemunha dos tempos, a luz da verdade.", author: "Cícero" },
  { text: "O tempo apaga o erro e pule a verdade.", author: "Gaston de Lévis" },
  { text: "O que a água traz, a água leva.", author: "Provérbio" },
  { text: "A vida é curta, a arte é longa.", author: "Hipócrates" },
  { text: "O tempo é um cirurgião que cura sem cortar.", author: "Anônimo" },
  { text: "Cada momento é um novo começo.", author: "T.S. Eliot" },
  { text: "Nós não lembramos dias, lembramos momentos.", author: "Cesare Pavese" },
  { text: "O tempo é a substância da qual sou feito.", author: "Jorge Luis Borges" },
  { text: "O que somos hoje vem dos nossos pensamentos de ontem.", author: "Buda" },
  { text: "A mente é tudo. O que você pensa, você se torna.", author: "Buda" },
  { text: "Quem olha para fora, sonha; quem olha para dentro, desperta.", author: "Carl Jung" },
  { text: "Tudo o que nos irrita nos outros pode nos levar a uma compreensão de nós mesmos.", author: "Carl Jung" },
  { text: "Conhece a ti mesmo.", author: "Sócrates" },
  { text: "A única sabedoria verdadeira é saber que você não sabe nada.", author: "Sócrates" },
  { text: "A educação é a arma mais poderosa que você pode usar para mudar o mundo.", author: "Nelson Mandela" },
  { text: "A liberdade não é nada mais que uma chance para ser melhor.", author: "Albert Camus" },
  { text: "No meio da dificuldade encontra-se a oportunidade.", author: "Albert Einstein" },
  { text: "A imaginação é mais importante que o conhecimento.", author: "Albert Einstein" },
  { text: "Duas coisas são infinitas: o universo e a estupidez humana. E não tenho certeza quanto ao universo.", author: "Albert Einstein" },
  { text: "A paz vem de dentro. Não a procure fora.", author: "Buda" },
  { text: "O segredo da saúde, mental e corporal, é não se lamentar pelo passado, não se preocupar com o futuro, nem se adiantar aos problemas, mas viver sabia e seriamente o presente.", author: "Buda" }
];

const WaybackMachine: React.FC = () => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('asc');

  // Quotes State - Initialize with random index
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(() => Math.floor(Math.random() * TIME_QUOTES.length));
  const [fadeQuote, setFadeQuote] = useState(true);

  // Quotes Rotation Effect
  useEffect(() => {
    const interval = setInterval(() => {
      setFadeQuote(false); // Start fade out
      
      setTimeout(() => {
        // Select random next quote (avoiding immediate repeat)
        setCurrentQuoteIndex((prev) => {
           let newIndex;
           do {
             newIndex = Math.floor(Math.random() * TIME_QUOTES.length);
           } while (newIndex === prev && TIME_QUOTES.length > 1);
           return newIndex;
        });
        setFadeQuote(true); // Start fade in
      }, 1000); // Wait for fade out to finish (matches CSS duration)

    }, 15000); // 15 seconds on screen

    return () => clearInterval(interval);
  }, []);

  // Helper to fetch from multiple providers
  const fetchFromProviders = async (targetCdxUrl: string) => {
      const timestamp = Date.now();
      const providers = [
        { 
          name: "Direct", 
          getUrl: () => targetCdxUrl,
          type: 'direct'
        },
        { 
          name: "AllOrigins", 
          getUrl: () => `https://api.allorigins.win/get?url=${encodeURIComponent(targetCdxUrl)}&t=${timestamp}`,
          type: 'json_wrapper'
        },
        { 
          name: "CorsProxy", 
          getUrl: () => `https://corsproxy.io/?${encodeURIComponent(targetCdxUrl)}`,
          type: 'direct'
        }
      ];

      let lastError = null;

      for (const provider of providers) {
        try {
          const fetchUrl = provider.getUrl();
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

          const response = await fetch(fetchUrl, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (!response.ok) {
             throw new Error(`HTTP ${response.status}`);
          }

          let text = '';

          if (provider.type === 'json_wrapper') {
            const wrapperData = await response.json();
            text = wrapperData.contents;
            if (!text && wrapperData.status?.http_code) {
               throw new Error(`Wrapper Error ${wrapperData.status.http_code}`);
            }
          } else {
            text = await response.text();
          }

          if (!text) throw new Error("Empty response");

          // Basic validation to ensure it's not an HTML error page
          if (text.trim().toLowerCase().startsWith('<')) {
            throw new Error("Received HTML instead of JSON");
          }

          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            return data; // Success
          } else {
            throw new Error("Response is not an array");
          }

        } catch (err: any) {
          console.warn(`Provider ${provider.name} failed:`, err.message);
          lastError = err;
          // Known bug in Wayback Machine CDX API: It omits CORS headers when returning an empty array.
          // This causes the browser to throw a 'Failed to fetch' (CORS error).
          // If Direct fails with this, and we have no other choice later, we can assume it's empty.
        }
      }

      // If all providers failed, check if the first (Direct) failed due to a CORS error.
      // In browsers, CORS errors manifest as 'Failed to fetch' or 'NetworkError'.
      if (lastError && (lastError.message === 'Failed to fetch' || lastError.message === 'NetworkError when attempting to fetch resource.')) {
         console.warn("Assuming empty result due to Wayback Machine CORS bug on empty responses.");
         return [];
      }

      throw lastError || new Error("Connection failed");
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsLoading(true);
    setError(null);
    setSnapshots([]);
    setCurrentPage(1);
    setTotalCount(0);

    try {
      // Base Params
      // We request 'statuscode' to filter client-side if needed
      // fl=timestamp,original,statuscode
      const fields = "timestamp,original,statuscode";
      const baseQuery = `url=${encodeURIComponent(url)}&output=json&fl=${fields}&limit=3000`;

      let data: any = null;

      // Strategy 1: Server-side filtering (Standard)
      // Efficient for bandwidth, but sometimes causes 503s on server
      try {
        const url1 = `https://web.archive.org/cdx/search/cdx?${baseQuery}&filter=statuscode:200`;
        data = await fetchFromProviders(url1);
      } catch (err1) {
        console.log("Strategy 1 failed, attempting Strategy 2 (Unfiltered Fallback)");
        
        // Strategy 2: Unfiltered (Fallback)
        // Moves processing load to client. Often bypasses server 503s caused by filtering.
        // We accept all status codes here and filter later.
        try {
            // Add a small delay before retry to be polite/allow recovery
            await new Promise(resolve => setTimeout(resolve, 1000));
            const url2 = `https://web.archive.org/cdx/search/cdx?${baseQuery}`; // No filter param
            data = await fetchFromProviders(url2);
        } catch (err2) {
            console.error(err2);
            throw new Error('O Wayback Machine está instável no momento (Erro 503). Por favor, tente novamente em alguns instantes.');
        }
      }

      if (!data || data.length <= 1) {
        setError('Nenhum registro encontrado para esta URL.');
        setIsLoading(false);
        return;
      }

      // Remove header row ["timestamp", "original", "statuscode"]
      const rows = data.slice(1);
      
      // Client-side processing
      // 1. Filter by status code 200 (important if using Strategy 2)
      // 2. Deduplicate by Day (one per day)
      
      const seenDates = new Set<string>();
      const filteredRows: string[][] = [];

      // Process rows
      for (const row of rows) {
        const timestamp = row[0];
        const original = row[1];
        const statusCode = row[2];

        // Ensure we only keep successful captures (200 OK)
        if (statusCode !== '200') continue;

        const dateKey = timestamp.substring(0, 8); // YYYYMMDD
        
        if (!seenDates.has(dateKey)) {
          seenDates.add(dateKey);
          filteredRows.push(row);
        }
      }

      if (filteredRows.length === 0) {
         setError('Nenhuma versão válida (Status 200) encontrada.');
         setIsLoading(false);
         return;
      }
      
      // Sort
      filteredRows.sort((a: string[], b: string[]) => {
        return sortOrder === 'asc' 
          ? a[0].localeCompare(b[0]) 
          : b[0].localeCompare(a[0]);
      });

      const formattedSnapshots: Snapshot[] = filteredRows.map((row: string[]) => {
        const timestamp = row[0];
        const original = row[1];
        const statusCode = row[2];
        
        const y = timestamp.substring(0, 4);
        const m = timestamp.substring(4, 6);
        const d = timestamp.substring(6, 8);
        const h = timestamp.substring(8, 10);
        const min = timestamp.substring(10, 12);
        
        return {
          timestamp,
          originalUrl: original,
          archiveUrl: `https://web.archive.org/web/${timestamp}/${original}`,
          dateFormatted: `${d}/${m}/${y} às ${h}:${min}`,
          statusCode
        };
      });

      setSnapshots(formattedSnapshots);
      setTotalCount(formattedSnapshots.length);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro desconhecido ao buscar dados.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSortOrder = () => {
    const newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    setSortOrder(newOrder);
    setSnapshots(prev => [...prev].reverse());
    setCurrentPage(1); 
  };

  // Pagination Logic
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentItems = snapshots.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const openAllOnPage = () => {
    if (currentItems.length > 15) {
        const confirm = window.confirm(`Você está prestes a abrir ${currentItems.length} abas. Isso pode travar seu navegador. Continuar?`);
        if (!confirm) return;
    }

    let blockedCount = 0;

    currentItems.forEach((snap) => {
      // Browsers often block multiple window.open calls triggered by a single event.
      // We check if the window was actually created.
      const w = window.open(snap.archiveUrl, '_blank');
      if (!w || w.closed || typeof w.closed === 'undefined') {
        blockedCount++;
      }
    });

    if (blockedCount > 0) {
      alert(`O navegador bloqueou a abertura de ${blockedCount} abas.\n\nPara abrir todas de uma vez, clique no ícone de "Pop-up bloqueado" na barra de endereços (geralmente no canto direito) e selecione "Sempre permitir".`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Search Section */}
      <div className="bg-gray-900/50 rounded-2xl border border-gray-800 overflow-hidden shadow-lg backdrop-blur-sm p-6 relative z-10">
        <div className="flex items-center gap-2 text-indigo-400 font-semibold mb-4">
          <History size={20} />
          <h3>Explorador do Wayback Machine</h3>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              type="text" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="exemplo.com.br"
              className="w-full bg-gray-950 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-all"
              required
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          </div>
          <button
            type="submit"
            disabled={isLoading || !url}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                Ver Histórico
              </>
            )}
          </button>
        </form>

        {error && (
            <div className="mt-4 flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              <AlertCircle size={16} />
              {error}
            </div>
        )}
      </div>

      {/* Elegant Quotes Section (Visible when no results are shown) */}
      {snapshots.length === 0 && (
        <div className="py-12 flex flex-col items-center justify-center text-center">
            <div 
              className={`max-w-3xl px-6 transition-opacity duration-1000 ease-in-out ${fadeQuote ? 'opacity-70' : 'opacity-0'}`}
            >
              <p className="text-2xl md:text-4xl font-serif italic text-white leading-relaxed tracking-wide drop-shadow-lg">
                "{TIME_QUOTES[currentQuoteIndex].text}"
              </p>
              <div className="flex items-center justify-center gap-4 mt-6">
                <div className="h-px w-12 bg-indigo-500/50"></div>
                <p className="text-sm font-medium text-indigo-300 uppercase tracking-[0.2em]">
                  {TIME_QUOTES[currentQuoteIndex].author}
                </p>
                <div className="h-px w-12 bg-indigo-500/50"></div>
              </div>
            </div>
        </div>
      )}

      {/* Results Section */}
      {snapshots.length > 0 && (
        <div className="bg-gray-900/60 rounded-2xl border border-gray-800 shadow-xl backdrop-blur-md overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
          
          {/* Header & Bulk Action */}
          <div className="p-4 border-b border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900/80">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                
                {/* Text Info */}
                <div className="flex flex-col">
                    <div className="flex items-baseline gap-2">
                        <span className="text-gray-200 font-semibold text-lg">{totalCount} versões</span>
                        <span className="text-gray-600 text-sm">|</span>
                        <span className="text-gray-500 text-sm">Página {currentPage} de {totalPages}</span>
                    </div>
                    <span className="text-xs text-gray-500">Só retornamos 1 resultado por dia</span>
                </div>

                <button 
                  onClick={toggleSortOrder}
                  className="w-fit flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-all"
                >
                  {sortOrder === 'desc' ? (
                    <>
                      <ArrowDown size={14} /> Mais Recentes
                    </>
                  ) : (
                    <>
                      <ArrowUp size={14} /> Mais Antigos
                    </>
                  )}
                </button>
            </div>
            
            <button
              onClick={openAllOnPage}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-all"
              title="Abrir os 10 links abaixo de uma vez"
            >
              <Layers size={16} />
              Abrir Todos da Página ({currentItems.length})
            </button>
          </div>

          {/* List */}
          <div className="divide-y divide-gray-800/50">
            {currentItems.map((snap) => (
              <div key={snap.timestamp} className="p-4 hover:bg-gray-800/30 transition-colors flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-indigo-400">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h4 className="text-gray-200 font-medium flex items-center gap-2">
                       {snap.dateFormatted}
                    </h4>
                    <a 
                      href={snap.archiveUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-indigo-400 transition-colors truncate max-w-[200px] sm:max-w-md block"
                    >
                      {snap.archiveUrl}
                    </a>
                  </div>
                </div>

                <a
                  href={snap.archiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-white hover:bg-indigo-600 rounded-lg transition-all"
                  title="Abrir em nova aba"
                >
                  <ExternalLink size={20} />
                </a>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-800 bg-gray-900/80 flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              
              <div className="px-4 py-2 bg-gray-800 rounded-lg text-sm text-gray-300 font-medium">
                {currentPage}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WaybackMachine;