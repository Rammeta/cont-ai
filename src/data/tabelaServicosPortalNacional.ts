// Tabela Oficial de Serviços do Portal Nacional da NFS-e (ADN / SEFIN)
// 335 códigos de 6 dígitos oficiais com descrição completa e correlação com a LC 116/2003

export interface ServicoPortalNacional {
  codigo: string;          // 6 dígitos (ex: "010101")
  descricao: string;       // Descrição oficial
  itemLc116: string;       // Item da LC 116 (ex: "1.01")
  grupo: string;           // 2 dígitos do grupo (ex: "01")
  grupoDescricao: string;  // Nome do grupo da LC 116
}

export const TABELA_SERVICOS_PORTAL_NACIONAL: ServicoPortalNacional[] = [
  {
    "codigo": "010101",
    "descricao": "Análise e desenvolvimento de sistemas.",
    "itemLc116": "1.01",
    "grupo": "01",
    "grupoDescricao": "Informática, Software e TI"
  },
  {
    "codigo": "010201",
    "descricao": "Programação.",
    "itemLc116": "1.02",
    "grupo": "01",
    "grupoDescricao": "Informática, Software e TI"
  },
  {
    "codigo": "010301",
    "descricao": "Processamento de dados, textos, imagens, vídeos, páginas eletrônicas, aplicativos e sistemas de informação, entre outros formatos, e congêneres.",
    "itemLc116": "1.03",
    "grupo": "01",
    "grupoDescricao": "Informática, Software e TI"
  },
  {
    "codigo": "010302",
    "descricao": "Armazenamento ou hospedagem de dados, textos, imagens, vídeos, páginas eletrônicas, aplicativos e sistemas de informação, entre outros formatos, e congêneres.",
    "itemLc116": "1.03",
    "grupo": "01",
    "grupoDescricao": "Informática, Software e TI"
  },
  {
    "codigo": "010401",
    "descricao": "Elaboração de programas de computadores, inclusive de jogos eletrônicos, independentemente da arquitetura construtiva da máquina em que o programa será executado, incluindo tablets, smartphones e congêneres.",
    "itemLc116": "1.04",
    "grupo": "01",
    "grupoDescricao": "Informática, Software e TI"
  },
  {
    "codigo": "010501",
    "descricao": "Licenciamento ou cessão de direito de uso de programas de computação.",
    "itemLc116": "1.05",
    "grupo": "01",
    "grupoDescricao": "Informática, Software e TI"
  },
  {
    "codigo": "010601",
    "descricao": "Assessoria e consultoria em informática.",
    "itemLc116": "1.06",
    "grupo": "01",
    "grupoDescricao": "Informática, Software e TI"
  },
  {
    "codigo": "010701",
    "descricao": "Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas de computação e bancos de dados.",
    "itemLc116": "1.07",
    "grupo": "01",
    "grupoDescricao": "Informática, Software e TI"
  },
  {
    "codigo": "010801",
    "descricao": "Planejamento, confecção, manutenção e atualização de páginas eletrônicas.",
    "itemLc116": "1.08",
    "grupo": "01",
    "grupoDescricao": "Informática, Software e TI"
  },
  {
    "codigo": "010901",
    "descricao": "Disponibilização, sem cessão definitiva, de conteúdos de áudio por meio da internet (exceto a distribuição de conteúdos pelas prestadoras de Serviço de Acesso Condicionado, de que trata a Lei nº 12.485, de 12 de setembro de 2011, sujeita ao ICMS).",
    "itemLc116": "1.09",
    "grupo": "01",
    "grupoDescricao": "Informática, Software e TI"
  },
  {
    "codigo": "010902",
    "descricao": "Disponibilização, sem cessão definitiva, de conteúdos de vídeo, imagem e texto por meio da internet, respeitada a imunidade de livros, jornais e periódicos (exceto a distribuição de conteúdos pelas prestadoras de Serviço de Acesso Condicionado, de que trata a Lei nº 12.485, de 12 de setembro de 2011, sujeita ao ICMS).",
    "itemLc116": "1.09",
    "grupo": "01",
    "grupoDescricao": "Informática, Software e TI"
  },
  {
    "codigo": "020101",
    "descricao": "Serviços de pesquisas e desenvolvimento de qualquer natureza.",
    "itemLc116": "2.01",
    "grupo": "02",
    "grupoDescricao": "Pesquisa e Desenvolvimento"
  },
  {
    "codigo": "030201",
    "descricao": "Cessão de direito de uso de marcas e de sinais de propaganda.",
    "itemLc116": "3.02",
    "grupo": "03",
    "grupoDescricao": "Locação, Cessão e Estruturas"
  },
  {
    "codigo": "030301",
    "descricao": "Exploração de salões de festas, centro de convenções, stands e congêneres, para realização de eventos ou negócios de qualquer natureza.",
    "itemLc116": "3.03",
    "grupo": "03",
    "grupoDescricao": "Locação, Cessão e Estruturas"
  },
  {
    "codigo": "030302",
    "descricao": "Exploração de escritórios virtuais e congêneres, para realização de eventos ou negócios de qualquer natureza.",
    "itemLc116": "3.03",
    "grupo": "03",
    "grupoDescricao": "Locação, Cessão e Estruturas"
  },
  {
    "codigo": "030303",
    "descricao": "Exploração de quadras esportivas, estádios, ginásios, canchas e congêneres, para realização de eventos ou negócios de qualquer natureza.",
    "itemLc116": "3.03",
    "grupo": "03",
    "grupoDescricao": "Locação, Cessão e Estruturas"
  },
  {
    "codigo": "030304",
    "descricao": "Exploração de auditórios, casas de espetáculos e congêneres, para realização de eventos ou negócios de qualquer natureza.",
    "itemLc116": "3.03",
    "grupo": "03",
    "grupoDescricao": "Locação, Cessão e Estruturas"
  },
  {
    "codigo": "030305",
    "descricao": "Exploração de parques de diversões e congêneres, para realização de eventos ou negócios de qualquer natureza.",
    "itemLc116": "3.03",
    "grupo": "03",
    "grupoDescricao": "Locação, Cessão e Estruturas"
  },
  {
    "codigo": "030401",
    "descricao": "Locação, sublocação, arrendamento, direito de passagem ou permissão de uso, compartilhado ou não, de ferrovia.",
    "itemLc116": "3.04",
    "grupo": "03",
    "grupoDescricao": "Locação, Cessão e Estruturas"
  },
  {
    "codigo": "030402",
    "descricao": "Locação, sublocação, arrendamento, direito de passagem ou permissão de uso, compartilhado ou não, de rodovia.",
    "itemLc116": "3.04",
    "grupo": "03",
    "grupoDescricao": "Locação, Cessão e Estruturas"
  },
  {
    "codigo": "030403",
    "descricao": "Locação, sublocação, arrendamento, direito de passagem ou permissão de uso, compartilhado ou não, de postes, cabos, dutos e condutos de qualquer natureza.",
    "itemLc116": "3.04",
    "grupo": "03",
    "grupoDescricao": "Locação, Cessão e Estruturas"
  },
  {
    "codigo": "030501",
    "descricao": "Cessão de andaimes, palcos, coberturas e outras estruturas de uso temporário.",
    "itemLc116": "3.05",
    "grupo": "03",
    "grupoDescricao": "Locação, Cessão e Estruturas"
  },
  {
    "codigo": "040101",
    "descricao": "Medicina.",
    "itemLc116": "4.01",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "040102",
    "descricao": "Biomedicina.",
    "itemLc116": "4.01",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "040201",
    "descricao": "Análises clínicas e congêneres.",
    "itemLc116": "4.02",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "040202",
    "descricao": "Patologia e congêneres.",
    "itemLc116": "4.02",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "040203",
    "descricao": "Eletricidade médica (eletroestimulação de nervos e musculos, cardioversão, etc) e congêneres.",
    "itemLc116": "4.02",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "040204",
    "descricao": "Radioterapia, quimioterapia e congêneres.",
    "itemLc116": "4.02",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "040205",
    "descricao": "Ultra-sonografia, ressonância magnética, radiologia, tomografia e congêneres.",
    "itemLc116": "4.02",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "040301",
    "descricao": "Hospitais e congêneres.",
    "itemLc116": "4.03",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "040302",
    "descricao": "Laboratórios e congêneres.",
    "itemLc116": "4.03",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "040303",
    "descricao": "Clínicas, sanatórios, manicômios, casas de saúde, prontos-socorros, ambulatórios e congêneres.",
    "itemLc116": "4.03",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "040401",
    "descricao": "Instrumentação cirúrgica.",
    "itemLc116": "4.04",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "040501",
    "descricao": "Acupuntura.",
    "itemLc116": "4.05",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "040601",
    "descricao": "Enfermagem, inclusive serviços auxiliares.",
    "itemLc116": "4.06",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "040701",
    "descricao": "Serviços farmacêuticos.",
    "itemLc116": "4.07",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "040801",
    "descricao": "Terapia ocupacional.",
    "itemLc116": "4.08",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "040802",
    "descricao": "Fisioterapia.",
    "itemLc116": "4.08",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "040803",
    "descricao": "Fonoaudiologia.",
    "itemLc116": "4.08",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "040901",
    "descricao": "Terapias de qualquer espécie destinadas ao tratamento físico, orgânico e mental.",
    "itemLc116": "4.09",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "041001",
    "descricao": "Nutrição.",
    "itemLc116": "4.10",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "041101",
    "descricao": "Obstetrícia.",
    "itemLc116": "4.11",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "041201",
    "descricao": "Odontologia.",
    "itemLc116": "4.12",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "041301",
    "descricao": "Ortóptica.",
    "itemLc116": "4.13",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "041401",
    "descricao": "Próteses sob encomenda.",
    "itemLc116": "4.14",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "041501",
    "descricao": "Psicanálise.",
    "itemLc116": "4.15",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "041601",
    "descricao": "Psicologia.",
    "itemLc116": "4.16",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "041701",
    "descricao": "Casas de repouso e congêneres.",
    "itemLc116": "4.17",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "041702",
    "descricao": "Casas de recuperação e congêneres.",
    "itemLc116": "4.17",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "041703",
    "descricao": "Creches e congêneres.",
    "itemLc116": "4.17",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "041704",
    "descricao": "Asilos e congêneres.",
    "itemLc116": "4.17",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "041801",
    "descricao": "Inseminação artificial, fertilização in vitro e congêneres.",
    "itemLc116": "4.18",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "041901",
    "descricao": "Bancos de sangue, leite, pele, olhos, óvulos, sêmen e congêneres.",
    "itemLc116": "4.19",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "042001",
    "descricao": "Coleta de sangue, leite, tecidos, sêmen, órgãos e materiais biológicos de qualquer espécie.",
    "itemLc116": "4.20",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "042101",
    "descricao": "Unidade de atendimento, assistência ou tratamento móvel e congêneres.",
    "itemLc116": "4.21",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "042201",
    "descricao": "Planos de medicina de grupo ou individual e convênios para prestação de assistência médica, hospitalar, odontológica e congêneres.",
    "itemLc116": "4.22",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "042301",
    "descricao": "Outros planos de saúde que se cumpram através de serviços de terceiros contratados, credenciados, cooperados ou apenas pagos pelo operador do plano mediante indicação do beneficiário.",
    "itemLc116": "4.23",
    "grupo": "04",
    "grupoDescricao": "Saúde Humana, Terapias e Medicina"
  },
  {
    "codigo": "050101",
    "descricao": "Medicina veterinária",
    "itemLc116": "5.01",
    "grupo": "05",
    "grupoDescricao": "Veterinária e Cuidados com Animais"
  },
  {
    "codigo": "050102",
    "descricao": "Zootecnia.",
    "itemLc116": "5.01",
    "grupo": "05",
    "grupoDescricao": "Veterinária e Cuidados com Animais"
  },
  {
    "codigo": "050201",
    "descricao": "Hospitais e congêneres, na área veterinária.",
    "itemLc116": "5.02",
    "grupo": "05",
    "grupoDescricao": "Veterinária e Cuidados com Animais"
  },
  {
    "codigo": "050202",
    "descricao": "Clínicas, ambulatórios, prontos-socorros e congêneres, na área veterinária.",
    "itemLc116": "5.02",
    "grupo": "05",
    "grupoDescricao": "Veterinária e Cuidados com Animais"
  },
  {
    "codigo": "050301",
    "descricao": "Laboratórios de análise na área veterinária.",
    "itemLc116": "5.03",
    "grupo": "05",
    "grupoDescricao": "Veterinária e Cuidados com Animais"
  },
  {
    "codigo": "050401",
    "descricao": "Inseminação artificial, fertilização in vitro e congêneres.",
    "itemLc116": "5.04",
    "grupo": "05",
    "grupoDescricao": "Veterinária e Cuidados com Animais"
  },
  {
    "codigo": "050501",
    "descricao": "Bancos de sangue e de órgãos e congêneres.",
    "itemLc116": "5.05",
    "grupo": "05",
    "grupoDescricao": "Veterinária e Cuidados com Animais"
  },
  {
    "codigo": "050601",
    "descricao": "Coleta de sangue, leite, tecidos, sêmen, órgãos e materiais biológicos de qualquer espécie.",
    "itemLc116": "5.06",
    "grupo": "05",
    "grupoDescricao": "Veterinária e Cuidados com Animais"
  },
  {
    "codigo": "050701",
    "descricao": "Unidade de atendimento, assistência ou tratamento móvel e congêneres.",
    "itemLc116": "5.07",
    "grupo": "05",
    "grupoDescricao": "Veterinária e Cuidados com Animais"
  },
  {
    "codigo": "050801",
    "descricao": "Guarda, tratamento, amestramento, embelezamento, alojamento e congêneres.",
    "itemLc116": "5.08",
    "grupo": "05",
    "grupoDescricao": "Veterinária e Cuidados com Animais"
  },
  {
    "codigo": "050901",
    "descricao": "Planos de atendimento e assistência médico-veterinária.",
    "itemLc116": "5.09",
    "grupo": "05",
    "grupoDescricao": "Veterinária e Cuidados com Animais"
  },
  {
    "codigo": "060101",
    "descricao": "Barbearia, cabeleireiros, manicuros, pedicuros e congêneres.",
    "itemLc116": "6.01",
    "grupo": "06",
    "grupoDescricao": "Estética, Beleza e Bem-Estar"
  },
  {
    "codigo": "060201",
    "descricao": "Esteticistas, tratamento de pele, depilação e congêneres.",
    "itemLc116": "6.02",
    "grupo": "06",
    "grupoDescricao": "Estética, Beleza e Bem-Estar"
  },
  {
    "codigo": "060301",
    "descricao": "Banhos, duchas, sauna, massagens e congêneres.",
    "itemLc116": "6.03",
    "grupo": "06",
    "grupoDescricao": "Estética, Beleza e Bem-Estar"
  },
  {
    "codigo": "060401",
    "descricao": "Ginástica, dança, esportes, natação, artes marciais e demais atividades físicas.",
    "itemLc116": "6.04",
    "grupo": "06",
    "grupoDescricao": "Estética, Beleza e Bem-Estar"
  },
  {
    "codigo": "060501",
    "descricao": "Centros de emagrecimento, spa e congêneres.",
    "itemLc116": "6.05",
    "grupo": "06",
    "grupoDescricao": "Estética, Beleza e Bem-Estar"
  },
  {
    "codigo": "060601",
    "descricao": "Aplicação de tatuagens, piercings e congêneres.",
    "itemLc116": "6.06",
    "grupo": "06",
    "grupoDescricao": "Estética, Beleza e Bem-Estar"
  },
  {
    "codigo": "070101",
    "descricao": "Engenharia e congêneres.",
    "itemLc116": "7.01",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070102",
    "descricao": "Agronomia e congêneres.",
    "itemLc116": "7.01",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070103",
    "descricao": "Agrimensura e congêneres.",
    "itemLc116": "7.01",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070104",
    "descricao": "Arquitetura, urbanismo e congêneres.",
    "itemLc116": "7.01",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070105",
    "descricao": "Geologia e congêneres.",
    "itemLc116": "7.01",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070106",
    "descricao": "Paisagismo e congêneres.",
    "itemLc116": "7.01",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070201",
    "descricao": "Execução, por administração, de obras de construção civil, hidráulica ou elétrica e de outras obras semelhantes, inclusive sondagem, perfuração de poços, escavação, drenagem e irrigação, terraplanagem, pavimentação, concretagem e a instalação e montagem de produtos, peças e equipamentos (exceto o fornecimento de mercadorias produzidas pelo prestador de serviços fora do local da prestação dos serviços, que fica sujeito ao ICMS).",
    "itemLc116": "7.02",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070202",
    "descricao": "Execução, por empreitada ou subempreitada, de obras de construção civil, hidráulica ou elétrica e de outras obras semelhantes, inclusive sondagem, perfuração de poços, escavação, drenagem e irrigação, terraplanagem, pavimentação, concretagem e a instalação e montagem de produtos, peças e equipamentos (exceto o fornecimento de mercadorias produzidas pelo prestador de serviços fora do local da prestação dos serviços, que fica sujeito ao ICMS).",
    "itemLc116": "7.02",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070301",
    "descricao": "Elaboração de planos diretores, estudos de viabilidade, estudos organizacionais e outros, relacionados com obras e serviços de engenharia.",
    "itemLc116": "7.03",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070302",
    "descricao": "Elaboração de anteprojetos, projetos básicos e projetos executivos para trabalhos de engenharia.",
    "itemLc116": "7.03",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070401",
    "descricao": "Demolição.",
    "itemLc116": "7.04",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070501",
    "descricao": "Reparação, conservação e reforma de edifícios e congêneres (exceto o fornecimento de mercadorias produzidas pelo prestador dos serviços, fora do local da prestação dos serviços, que fica sujeito ao ICMS).",
    "itemLc116": "7.05",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070502",
    "descricao": "Reparação, conservação e reforma de estradas, pontes, portos e congêneres (exceto o fornecimento de mercadorias produzidas pelo prestador dos serviços, fora do local da prestação dos serviços, que fica sujeito ao ICMS).",
    "itemLc116": "7.05",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070601",
    "descricao": "Colocação e instalação de tapetes, carpetes, cortinas e congêneres, com material fornecido pelo tomador do serviço.",
    "itemLc116": "7.06",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070602",
    "descricao": "Colocação e instalação de assoalhos, revestimentos de parede, vidros, divisórias, placas de gesso e congêneres, com material fornecido pelo tomador do serviço.",
    "itemLc116": "7.06",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070701",
    "descricao": "Recuperação, raspagem, polimento e lustração de pisos e congêneres.",
    "itemLc116": "7.07",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070801",
    "descricao": "Calafetação.",
    "itemLc116": "7.08",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070901",
    "descricao": "Varrição, coleta e remoção de lixo, rejeitos e outros resíduos quaisquer.",
    "itemLc116": "7.09",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "070902",
    "descricao": "Incineração, tratamento, reciclagem, separação e destinação final de lixo, rejeitos e outros resíduos quaisquer.",
    "itemLc116": "7.09",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "071001",
    "descricao": "Limpeza, manutenção e conservação de vias e logradouros públicos, parques, jardins e congêneres.",
    "itemLc116": "7.10",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "071002",
    "descricao": "Limpeza, manutenção e conservação de imóveis, chaminés, piscinas e congêneres.",
    "itemLc116": "7.10",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "071101",
    "descricao": "Decoração.",
    "itemLc116": "7.11",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "071102",
    "descricao": "Jardinagem, inclusive corte e poda de árvores.",
    "itemLc116": "7.11",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "071201",
    "descricao": "Controle e tratamento de efluentes de qualquer natureza e de agentes físicos, químicos e biológicos.",
    "itemLc116": "7.12",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "071301",
    "descricao": "Dedetização, desinfecção, desinsetização, imunização, higienização, desratização, pulverização e congêneres.",
    "itemLc116": "7.13",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "071601",
    "descricao": "Florestamento, reflorestamento, semeadura, adubação, reparação de solo, plantio, silagem, colheita, corte e descascamento de árvores, silvicultura, exploração florestal e dos serviços congêneres indissociáveis da formação, manutenção e colheita de florestas, para quaisquer fins e por quaisquer meios.",
    "itemLc116": "7.16",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "071701",
    "descricao": "Escoramento, contenção de encostas e serviços congêneres.",
    "itemLc116": "7.17",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "071801",
    "descricao": "Limpeza e dragagem de rios, portos, canais, baías, lagos, lagoas, represas, açudes e congêneres.",
    "itemLc116": "7.18",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "071901",
    "descricao": "Acompanhamento e fiscalização da execução de obras de engenharia, arquitetura e urbanismo.",
    "itemLc116": "7.19",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "072001",
    "descricao": "Aerofotogrametria (inclusive interpretação), cartografia, mapeamento e congêneres.",
    "itemLc116": "7.20",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "072002",
    "descricao": "Levantamentos batimétricos, geográficos, geodésicos, geológicos, geofísicos e congêneres.",
    "itemLc116": "7.20",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "072003",
    "descricao": "Levantamentos topográficos e congêneres.",
    "itemLc116": "7.20",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "072101",
    "descricao": "Pesquisa, perfuração, cimentação, mergulho, perfilagem, concretação, testemunhagem, pescaria, estimulação e outros serviços relacionados com a exploração e explotação de petróleo, gás natural e de outros recursos minerais.",
    "itemLc116": "7.21",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "072201",
    "descricao": "Nucleação e bombardeamento de nuvens e congêneres.",
    "itemLc116": "7.22",
    "grupo": "07",
    "grupoDescricao": "Engenharia, Arquitetura e Obras"
  },
  {
    "codigo": "080101",
    "descricao": "Ensino regular pré-escolar, fundamental e médio.",
    "itemLc116": "8.01",
    "grupo": "08",
    "grupoDescricao": "Educação, Ensino e Treinamentos"
  },
  {
    "codigo": "080102",
    "descricao": "Ensino regular superior.",
    "itemLc116": "8.01",
    "grupo": "08",
    "grupoDescricao": "Educação, Ensino e Treinamentos"
  },
  {
    "codigo": "080201",
    "descricao": "Instrução, treinamento, orientação pedagógica e educacional, avaliação de conhecimentos de qualquer natureza.",
    "itemLc116": "8.02",
    "grupo": "08",
    "grupoDescricao": "Educação, Ensino e Treinamentos"
  },
  {
    "codigo": "090101",
    "descricao": "Hospedagem em hotéis, hotelaria marítima e congêneres (o valor da alimentação e gorjeta, quando incluído no preço da diária, fica sujeito ao Imposto Sobre Serviços).",
    "itemLc116": "9.01",
    "grupo": "09",
    "grupoDescricao": "Hospedagem, Hotelaria e Turismo"
  },
  {
    "codigo": "090102",
    "descricao": "Hospedagem em pensões, albergues, pousadas, hospedarias, ocupação por temporada com fornecimento de serviços e congêneres (o valor da alimentação e gorjeta, quando incluído no preço da diária, fica sujeito ao Imposto Sobre Serviços).",
    "itemLc116": "9.01",
    "grupo": "09",
    "grupoDescricao": "Hospedagem, Hotelaria e Turismo"
  },
  {
    "codigo": "090103",
    "descricao": "Hospedagem em motéis e congêneres (o valor da alimentação e gorjeta, quando incluído no preço da diária, fica sujeito ao Imposto Sobre Serviços).",
    "itemLc116": "9.01",
    "grupo": "09",
    "grupoDescricao": "Hospedagem, Hotelaria e Turismo"
  },
  {
    "codigo": "090104",
    "descricao": "Hospedagem em apart-service condominiais, flat, apart-hotéis, hotéis residência, residence-service, suite service e congêneres (o valor da alimentação e gorjeta, quando incluído no preço da diária, fica sujeito ao Imposto Sobre Serviços).",
    "itemLc116": "9.01",
    "grupo": "09",
    "grupoDescricao": "Hospedagem, Hotelaria e Turismo"
  },
  {
    "codigo": "090201",
    "descricao": "Agenciamento e intermediação de programas de turismo, passeios, viagens, excursões, hospedagens e congêneres.",
    "itemLc116": "9.02",
    "grupo": "09",
    "grupoDescricao": "Hospedagem, Hotelaria e Turismo"
  },
  {
    "codigo": "090202",
    "descricao": "Organização, promoção e execução de programas de turismo, passeios, viagens, excursões, hospedagens e congêneres.",
    "itemLc116": "9.02",
    "grupo": "09",
    "grupoDescricao": "Hospedagem, Hotelaria e Turismo"
  },
  {
    "codigo": "090301",
    "descricao": "Guias de turismo.",
    "itemLc116": "9.03",
    "grupo": "09",
    "grupoDescricao": "Hospedagem, Hotelaria e Turismo"
  },
  {
    "codigo": "100101",
    "descricao": "Agenciamento, corretagem ou intermediação de câmbio.",
    "itemLc116": "10.01",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "100102",
    "descricao": "Agenciamento, corretagem ou intermediação de seguros.",
    "itemLc116": "10.01",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "100103",
    "descricao": "Agenciamento, corretagem ou intermediação de cartões de crédito.",
    "itemLc116": "10.01",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "100104",
    "descricao": "Agenciamento, corretagem ou intermediação de planos de saúde.",
    "itemLc116": "10.01",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "100105",
    "descricao": "Agenciamento, corretagem ou intermediação de planos de previdência privada.",
    "itemLc116": "10.01",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "100201",
    "descricao": "Agenciamento, corretagem ou intermediação de títulos em geral e valores mobiliários.",
    "itemLc116": "10.02",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "100202",
    "descricao": "Agenciamento, corretagem ou intermediação de contratos quaisquer.",
    "itemLc116": "10.02",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "100301",
    "descricao": "Agenciamento, corretagem ou intermediação de direitos de propriedade industrial, artística ou literária.",
    "itemLc116": "10.03",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "100401",
    "descricao": "Agenciamento, corretagem ou intermediação de contratos de arrendamento mercantil (leasing).",
    "itemLc116": "10.04",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "100402",
    "descricao": "Agenciamento, corretagem ou intermediação de contratos de franquia (franchising).",
    "itemLc116": "10.04",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "100403",
    "descricao": "Agenciamento, corretagem ou intermediação de faturização (factoring).",
    "itemLc116": "10.04",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "100501",
    "descricao": "Agenciamento, corretagem ou intermediação de bens móveis ou imóveis, não abrangidos em outros itens ou subitens, por quaisquer meios.",
    "itemLc116": "10.05",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "100502",
    "descricao": "Agenciamento, corretagem ou intermediação de bens móveis ou imóveis realizados no âmbito de Bolsas de Mercadorias e Futuros, por quaisquer meios.",
    "itemLc116": "10.05",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "100601",
    "descricao": "Agenciamento marítimo.",
    "itemLc116": "10.06",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "100701",
    "descricao": "Agenciamento de notícias.",
    "itemLc116": "10.07",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "100801",
    "descricao": "Agenciamento de publicidade e propaganda, inclusive o agenciamento de veiculação por quaisquer meios.",
    "itemLc116": "10.08",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "100901",
    "descricao": "Representação de qualquer natureza, inclusive comercial.",
    "itemLc116": "10.09",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "101001",
    "descricao": "Distribuição de bens de terceiros.",
    "itemLc116": "10.10",
    "grupo": "10",
    "grupoDescricao": "Intermediação, Corretagem e Agenciamento"
  },
  {
    "codigo": "110101",
    "descricao": "Guarda e estacionamento de veículos terrestres automotores.",
    "itemLc116": "11.01",
    "grupo": "11",
    "grupoDescricao": "Guarda, Vigilância e Estacionamento"
  },
  {
    "codigo": "110102",
    "descricao": "Guarda e estacionamento de aeronaves e de embarcações.",
    "itemLc116": "11.01",
    "grupo": "11",
    "grupoDescricao": "Guarda, Vigilância e Estacionamento"
  },
  {
    "codigo": "110201",
    "descricao": "Vigilância, segurança ou monitoramento de bens, pessoas e semoventes.",
    "itemLc116": "11.02",
    "grupo": "11",
    "grupoDescricao": "Guarda, Vigilância e Estacionamento"
  },
  {
    "codigo": "110301",
    "descricao": "Escolta, inclusive de veículos e cargas.",
    "itemLc116": "11.03",
    "grupo": "11",
    "grupoDescricao": "Guarda, Vigilância e Estacionamento"
  },
  {
    "codigo": "110401",
    "descricao": "Armazenamento, depósito, guarda de bens de qualquer espécie.",
    "itemLc116": "11.04",
    "grupo": "11",
    "grupoDescricao": "Guarda, Vigilância e Estacionamento"
  },
  {
    "codigo": "110402",
    "descricao": "Carga, descarga, arrumação de bens de qualquer espécie.",
    "itemLc116": "11.04",
    "grupo": "11",
    "grupoDescricao": "Guarda, Vigilância e Estacionamento"
  },
  {
    "codigo": "120101",
    "descricao": "Espetáculos teatrais.",
    "itemLc116": "12.01",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "120201",
    "descricao": "Exibições cinematográficas.",
    "itemLc116": "12.02",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "120301",
    "descricao": "Espetáculos circenses.",
    "itemLc116": "12.03",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "120401",
    "descricao": "Programas de auditório.",
    "itemLc116": "12.04",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "120501",
    "descricao": "Parques de diversões, centros de lazer e congêneres.",
    "itemLc116": "12.05",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "120601",
    "descricao": "Boates, taxi-dancing e congêneres.",
    "itemLc116": "12.06",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "120701",
    "descricao": "Shows, ballet, danças, desfiles, bailes, óperas, concertos, recitais, festivais e congêneres.",
    "itemLc116": "12.07",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "120801",
    "descricao": "Feiras, exposições, congressos e congêneres.",
    "itemLc116": "12.08",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "120901",
    "descricao": "Bilhares.",
    "itemLc116": "12.09",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "120902",
    "descricao": "Boliches.",
    "itemLc116": "12.09",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "120903",
    "descricao": "Diversões eletrônicas ou não.",
    "itemLc116": "12.09",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "121001",
    "descricao": "Corridas e competições de animais.",
    "itemLc116": "12.10",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "121101",
    "descricao": "Competições esportivas ou de destreza física ou intelectual, com ou sem a participação do espectador.",
    "itemLc116": "12.11",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "121201",
    "descricao": "Execução de música.",
    "itemLc116": "12.12",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "121301",
    "descricao": "Produção, mediante ou sem encomenda prévia, de eventos, espetáculos, entrevistas, shows, ballet, danças, desfiles, bailes, teatros, óperas, concertos, recitais, festivais e congêneres.",
    "itemLc116": "12.13",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "121401",
    "descricao": "Fornecimento de música para ambientes fechados ou não, mediante transmissão por qualquer processo.",
    "itemLc116": "12.14",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "121501",
    "descricao": "Desfiles de blocos carnavalescos ou folclóricos, trios elétricos e congêneres.",
    "itemLc116": "12.15",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "121601",
    "descricao": "Exibição de filmes, entrevistas, musicais, espetáculos, shows, concertos, desfiles, óperas, competições esportivas, de destreza intelectual ou congêneres.",
    "itemLc116": "12.16",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "121701",
    "descricao": "Recreação e animação, inclusive em festas e eventos de qualquer natureza.",
    "itemLc116": "12.17",
    "grupo": "12",
    "grupoDescricao": "Artes, Cultura, Shows e Eventos"
  },
  {
    "codigo": "130201",
    "descricao": "Fonografia ou gravação de sons, inclusive trucagem, dublagem, mixagem e congêneres.",
    "itemLc116": "13.02",
    "grupo": "13",
    "grupoDescricao": "Fotografia, Som, Vídeo e Gráfica"
  },
  {
    "codigo": "130301",
    "descricao": "Fotografia e cinematografia, inclusive revelação, ampliação, cópia, reprodução, trucagem e congêneres.",
    "itemLc116": "13.03",
    "grupo": "13",
    "grupoDescricao": "Fotografia, Som, Vídeo e Gráfica"
  },
  {
    "codigo": "130401",
    "descricao": "Reprografia, microfilmagem e digitalização.",
    "itemLc116": "13.04",
    "grupo": "13",
    "grupoDescricao": "Fotografia, Som, Vídeo e Gráfica"
  },
  {
    "codigo": "130501",
    "descricao": "Composição gráfica, inclusive confecção de impressos gráficos, fotocomposição, clicheria, zincografia, litografia e fotolitografia, exceto se destinados a posterior operação de comercialização ou industrialização, ainda que incorporados, de qualquer forma, a outra mercadoria que deva ser objeto de posterior circulação, tais como bulas, rótulos, etiquetas, caixas, cartuchos, embalagens e manuais técnicos e de instrução, quando ficarão sujeitos ao ICMS.",
    "itemLc116": "13.05",
    "grupo": "13",
    "grupoDescricao": "Fotografia, Som, Vídeo e Gráfica"
  },
  {
    "codigo": "140101",
    "descricao": "Lubrificação, limpeza, lustração, revisão, carga e recarga, conserto, restauração, blindagem, manutenção e conservação de máquinas, veículos, aparelhos, equipamentos, motores, elevadores ou de qualquer objeto (exceto peças e partes empregadas, que ficam sujeitas ao ICMS).",
    "itemLc116": "14.01",
    "grupo": "14",
    "grupoDescricao": "Manutenção, Reparo, Limpeza e Oficinas"
  },
  {
    "codigo": "140201",
    "descricao": "Assistência técnica.",
    "itemLc116": "14.02",
    "grupo": "14",
    "grupoDescricao": "Manutenção, Reparo, Limpeza e Oficinas"
  },
  {
    "codigo": "140301",
    "descricao": "Recondicionamento de motores (exceto peças e partes empregadas, que ficam sujeitas ao ICMS).",
    "itemLc116": "14.03",
    "grupo": "14",
    "grupoDescricao": "Manutenção, Reparo, Limpeza e Oficinas"
  },
  {
    "codigo": "140401",
    "descricao": "Recauchutagem ou regeneração de pneus.",
    "itemLc116": "14.04",
    "grupo": "14",
    "grupoDescricao": "Manutenção, Reparo, Limpeza e Oficinas"
  },
  {
    "codigo": "140501",
    "descricao": "Restauração, recondicionamento, acondicionamento, pintura, beneficiamento, lavagem, secagem, tingimento, galvanoplastia, anodização, corte, recorte, plastificação, costura, acabamento, polimento e congêneres de objetos quaisquer.",
    "itemLc116": "14.05",
    "grupo": "14",
    "grupoDescricao": "Manutenção, Reparo, Limpeza e Oficinas"
  },
  {
    "codigo": "140601",
    "descricao": "Instalação e montagem de aparelhos, máquinas e equipamentos, inclusive montagem industrial, prestados ao usuário final, exclusivamente com material por ele fornecido.",
    "itemLc116": "14.06",
    "grupo": "14",
    "grupoDescricao": "Manutenção, Reparo, Limpeza e Oficinas"
  },
  {
    "codigo": "140701",
    "descricao": "Colocação de molduras e congêneres.",
    "itemLc116": "14.07",
    "grupo": "14",
    "grupoDescricao": "Manutenção, Reparo, Limpeza e Oficinas"
  },
  {
    "codigo": "140801",
    "descricao": "Encadernação, gravação e douração de livros, revistas e congêneres.",
    "itemLc116": "14.08",
    "grupo": "14",
    "grupoDescricao": "Manutenção, Reparo, Limpeza e Oficinas"
  },
  {
    "codigo": "140901",
    "descricao": "Alfaiataria e costura, quando o material for fornecido pelo usuário final, exceto aviamento.",
    "itemLc116": "14.09",
    "grupo": "14",
    "grupoDescricao": "Manutenção, Reparo, Limpeza e Oficinas"
  },
  {
    "codigo": "141001",
    "descricao": "Tinturaria e lavanderia.",
    "itemLc116": "14.10",
    "grupo": "14",
    "grupoDescricao": "Manutenção, Reparo, Limpeza e Oficinas"
  },
  {
    "codigo": "141101",
    "descricao": "Tapeçaria e reforma de estofamentos em geral.",
    "itemLc116": "14.11",
    "grupo": "14",
    "grupoDescricao": "Manutenção, Reparo, Limpeza e Oficinas"
  },
  {
    "codigo": "141201",
    "descricao": "Funilaria e lanternagem.",
    "itemLc116": "14.12",
    "grupo": "14",
    "grupoDescricao": "Manutenção, Reparo, Limpeza e Oficinas"
  },
  {
    "codigo": "141301",
    "descricao": "Carpintaria.",
    "itemLc116": "14.13",
    "grupo": "14",
    "grupoDescricao": "Manutenção, Reparo, Limpeza e Oficinas"
  },
  {
    "codigo": "141302",
    "descricao": "Serralheria.",
    "itemLc116": "14.13",
    "grupo": "14",
    "grupoDescricao": "Manutenção, Reparo, Limpeza e Oficinas"
  },
  {
    "codigo": "141401",
    "descricao": "Guincho intramunicipal.",
    "itemLc116": "14.14",
    "grupo": "14",
    "grupoDescricao": "Manutenção, Reparo, Limpeza e Oficinas"
  },
  {
    "codigo": "141402",
    "descricao": "Guindaste e içamento.",
    "itemLc116": "14.14",
    "grupo": "14",
    "grupoDescricao": "Manutenção, Reparo, Limpeza e Oficinas"
  },
  {
    "codigo": "150101",
    "descricao": "Administração de fundos quaisquer e congêneres.",
    "itemLc116": "15.01",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150102",
    "descricao": "Administração de consórcio e congêneres.",
    "itemLc116": "15.01",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150103",
    "descricao": "Administração de cartão de crédito ou débito e congêneres.",
    "itemLc116": "15.01",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150104",
    "descricao": "Administração de carteira de clientes e congêneres.",
    "itemLc116": "15.01",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150105",
    "descricao": "Administração de cheques pré-datados e congêneres.",
    "itemLc116": "15.01",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150201",
    "descricao": "Abertura de conta-corrente no País, bem como a manutenção da referida conta ativa e inativa.",
    "itemLc116": "15.02",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150202",
    "descricao": "Abertura de conta-corrente no exterior, bem como a manutenção da referida conta ativa e inativa.",
    "itemLc116": "15.02",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150203",
    "descricao": "Abertura de conta de investimentos e aplicação no País, bem como a manutenção da referida conta ativa e inativa.",
    "itemLc116": "15.02",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150204",
    "descricao": "Abertura de conta de investimentos e aplicação no exterior, bem como a manutenção da referida conta ativa e inativa.",
    "itemLc116": "15.02",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150205",
    "descricao": "Abertura de caderneta de poupança no País, bem como a manutenção da referida conta ativa e inativa.",
    "itemLc116": "15.02",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150206",
    "descricao": "Abertura de caderneta de poupança no exterior, bem como a manutenção da referida conta ativa e inativa.",
    "itemLc116": "15.02",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150207",
    "descricao": "Abertura de contas em geral no País, não abrangida em outro subitem, bem como a manutenção das referidas contas ativas e inativas.",
    "itemLc116": "15.02",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150208",
    "descricao": "Abertura de contas em geral no exterior, não abrangida em outro subitem, bem como a manutenção das referidas contas ativas e inativas.",
    "itemLc116": "15.02",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150301",
    "descricao": "Locação de cofres particulares.",
    "itemLc116": "15.03",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150302",
    "descricao": "Manutenção de cofres particulares.",
    "itemLc116": "15.03",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150303",
    "descricao": "Locação de terminais eletrônicos.",
    "itemLc116": "15.03",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150304",
    "descricao": "Manutenção de terminais eletrônicos.",
    "itemLc116": "15.03",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150305",
    "descricao": "Locação de terminais de atendimento.",
    "itemLc116": "15.03",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150306",
    "descricao": "Manutenção de terminais de atendimento.",
    "itemLc116": "15.03",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150307",
    "descricao": "Locação de bens e equipamentos em geral.",
    "itemLc116": "15.03",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150308",
    "descricao": "Manutenção de bens e equipamentos em geral.",
    "itemLc116": "15.03",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150401",
    "descricao": "Fornecimento ou emissão de atestados em geral, inclusive atestado de idoneidade, atestado de capacidade financeira e congêneres.",
    "itemLc116": "15.04",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150501",
    "descricao": "Cadastro, elaboração de ficha cadastral, renovação cadastral e congêneres.",
    "itemLc116": "15.05",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150502",
    "descricao": "Inclusão no Cadastro de Emitentes de Cheques sem Fundos - CCF.",
    "itemLc116": "15.05",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150503",
    "descricao": "Exclusão no Cadastro de Emitentes de Cheques sem Fundos - CCF.",
    "itemLc116": "15.05",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150504",
    "descricao": "Inclusão em quaisquer outros bancos cadastrais.",
    "itemLc116": "15.05",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150505",
    "descricao": "Exclusão em quaisquer outros bancos cadastrais.",
    "itemLc116": "15.05",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150601",
    "descricao": "Emissão, reemissão e fornecimento de avisos, comprovantes e documentos em geral",
    "itemLc116": "15.06",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150602",
    "descricao": "Abono de firmas.",
    "itemLc116": "15.06",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150603",
    "descricao": "Coleta e entrega de documentos, bens e valores.",
    "itemLc116": "15.06",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150604",
    "descricao": "Comunicação com outra agência ou com a administração central.",
    "itemLc116": "15.06",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150605",
    "descricao": "Licenciamento eletrônico de veículos.",
    "itemLc116": "15.06",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150606",
    "descricao": "Transferência de veículos.",
    "itemLc116": "15.06",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150607",
    "descricao": "Agenciamento fiduciário ou depositário.",
    "itemLc116": "15.06",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150608",
    "descricao": "Devolução de bens em custódia.",
    "itemLc116": "15.06",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150701",
    "descricao": "Acesso, movimentação, atendimento e consulta a contas em geral, por qualquer meio ou processo, inclusive por telefone, fac-símile, internet e telex.",
    "itemLc116": "15.07",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150702",
    "descricao": "Acesso a terminais de atendimento, inclusive vinte e quatro horas.",
    "itemLc116": "15.07",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150703",
    "descricao": "Acesso a outro banco e à rede compartilhada.",
    "itemLc116": "15.07",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150704",
    "descricao": "Fornecimento de saldo, extrato e demais informações relativas a contas em geral, por qualquer meio ou processo.",
    "itemLc116": "15.07",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150801",
    "descricao": "Emissão, reemissão, alteração, cessão, substituição, cancelamento e registro de contrato de crédito.",
    "itemLc116": "15.08",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150802",
    "descricao": "Estudo, análise e avaliação de operações de crédito.",
    "itemLc116": "15.08",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150803",
    "descricao": "Emissão, concessão, alteração ou contratação de aval, fiança, anuência e congêneres.",
    "itemLc116": "15.08",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150804",
    "descricao": "Serviços relativos à abertura de crédito, para quaisquer fins.",
    "itemLc116": "15.08",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "150901",
    "descricao": "Arrendamento mercantil (leasing) de quaisquer bens, inclusive cessão de direitos e obrigações, substituição de garantia, alteração, cancelamento e registro de contrato, e demais serviços relacionados ao arrendamento mercantil (leasing).",
    "itemLc116": "15.09",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151001",
    "descricao": "Serviços relacionados a cobranças em geral, de títulos quaisquer, de contas ou carnês, de câmbio, de tributos e por conta de terceiros, inclusive os efetuados por meio eletrônico, automático ou por máquinas de atendimento.",
    "itemLc116": "15.10",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151002",
    "descricao": "Serviços relacionados a recebimentos em geral, de títulos quaisquer, de contas ou carnês, de câmbio, de tributos e por conta de terceiros, inclusive os efetuados por meio eletrônico, automático ou por máquinas de atendimento.",
    "itemLc116": "15.10",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151003",
    "descricao": "Serviços relacionados a pagamentos em geral, de títulos quaisquer, de contas ou carnês, de câmbio, de tributos e por conta de terceiros, inclusive os efetuados por meio eletrônico, automático ou por máquinas de atendimento.",
    "itemLc116": "15.10",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151004",
    "descricao": "Serviços relacionados a fornecimento de posição de cobrança, recebimento ou pagamento.",
    "itemLc116": "15.10",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151005",
    "descricao": "Serviços relacionados a emissão de carnês, fichas de compensação, impressos e documentos em geral.",
    "itemLc116": "15.10",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151101",
    "descricao": "Devolução de títulos, protesto de títulos, sustação de protesto, manutenção de títulos, reapresentação de títulos, e demais serviços a eles relacionados.",
    "itemLc116": "15.11",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151201",
    "descricao": "Custódia em geral, inclusive de títulos e valores mobiliários.",
    "itemLc116": "15.12",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151301",
    "descricao": "Serviços relacionados a operações de câmbio em geral, edição, alteração, prorrogação, cancelamento e baixa de contrato de câmbio.",
    "itemLc116": "15.13",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151302",
    "descricao": "Serviços relacionados a emissão de registro de exportação ou de crédito.",
    "itemLc116": "15.13",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151303",
    "descricao": "Serviços relacionados a cobrança ou depósito no exterior.",
    "itemLc116": "15.13",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151304",
    "descricao": "Serviços relacionados a emissão, fornecimento e cancelamento de cheques de viagem.",
    "itemLc116": "15.13",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151305",
    "descricao": "Serviços relacionados a fornecimento, transferência, cancelamento e demais serviços relativos a carta de crédito de importação, exportação e garantias recebidas.",
    "itemLc116": "15.13",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151306",
    "descricao": "Serviços relacionados a envio e recebimento de mensagens em geral relacionadas a operações de câmbio.",
    "itemLc116": "15.13",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151401",
    "descricao": "Fornecimento, emissão, reemissão de cartão magnético, cartão de crédito, cartão de débito, cartão salário e congêneres.",
    "itemLc116": "15.14",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151402",
    "descricao": "Renovação de cartão magnético, cartão de crédito, cartão de débito, cartão salário e congêneres.",
    "itemLc116": "15.14",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151403",
    "descricao": "Manutenção de cartão magnético, cartão de crédito, cartão de débito, cartão salário e congêneres.",
    "itemLc116": "15.14",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151501",
    "descricao": "Compensação de cheques e títulos quaisquer.",
    "itemLc116": "15.15",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151502",
    "descricao": "Serviços relacionados a depósito, inclusive depósito identificado, a saque de contas quaisquer, por qualquer meio ou processo, inclusive em terminais eletrônicos e de atendimento.",
    "itemLc116": "15.15",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151601",
    "descricao": "Emissão, reemissão, liquidação, alteração, cancelamento e baixa de ordens de pagamento, ordens de crédito e similares, por qualquer meio ou processo.",
    "itemLc116": "15.16",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151602",
    "descricao": "Serviços relacionados à transferência de valores, dados, fundos, pagamentos e similares, inclusive entre contas em geral.",
    "itemLc116": "15.16",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151701",
    "descricao": "Emissão e fornecimento de cheques quaisquer, avulso ou por talão.",
    "itemLc116": "15.17",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151702",
    "descricao": "Devolução de cheques quaisquer, avulso ou por talão.",
    "itemLc116": "15.17",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151703",
    "descricao": "Sustação, cancelamento e oposição de cheques quaisquer, avulso ou por talão.",
    "itemLc116": "15.17",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151801",
    "descricao": "Serviços relacionados a crédito imobiliário, de avaliação e vistoria de imóvel ou obra.",
    "itemLc116": "15.18",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151802",
    "descricao": "Serviços relacionados a crédito imobiliário, de análise técnica e jurídica.",
    "itemLc116": "15.18",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151803",
    "descricao": "Serviços relacionados a crédito imobiliário, de emissão, reemissão, alteração, transferência e renegociação de contrato.",
    "itemLc116": "15.18",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151804",
    "descricao": "Serviços relacionados a crédito imobiliário, de emissão e reemissão do termo de quitação.",
    "itemLc116": "15.18",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "151805",
    "descricao": "Demais serviços relacionados a crédito imobiliário.",
    "itemLc116": "15.18",
    "grupo": "15",
    "grupoDescricao": "Serviços Financeiros e Crédito"
  },
  {
    "codigo": "160101",
    "descricao": "Serviços de transporte coletivo municipal rodoviário de passageiros.",
    "itemLc116": "16.01",
    "grupo": "16",
    "grupoDescricao": "Transporte Municipal de Passageiros"
  },
  {
    "codigo": "160102",
    "descricao": "Serviços de transporte coletivo municipal metroviário de passageiros.",
    "itemLc116": "16.01",
    "grupo": "16",
    "grupoDescricao": "Transporte Municipal de Passageiros"
  },
  {
    "codigo": "160103",
    "descricao": "Serviços de transporte coletivo municipal ferroviário de passageiros.",
    "itemLc116": "16.01",
    "grupo": "16",
    "grupoDescricao": "Transporte Municipal de Passageiros"
  },
  {
    "codigo": "160104",
    "descricao": "Serviços de transporte coletivo municipal aquaviário de passageiros.",
    "itemLc116": "16.01",
    "grupo": "16",
    "grupoDescricao": "Transporte Municipal de Passageiros"
  },
  {
    "codigo": "160201",
    "descricao": "Outros serviços de transporte de natureza municipal.",
    "itemLc116": "16.02",
    "grupo": "16",
    "grupoDescricao": "Transporte Municipal de Passageiros"
  },
  {
    "codigo": "170101",
    "descricao": "Assessoria ou consultoria de qualquer natureza, não contida em outros itens desta lista.",
    "itemLc116": "17.01",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "170102",
    "descricao": "Análise, exame, pesquisa, coleta, compilação e fornecimento de dados e informações de qualquer natureza, inclusive cadastro e similares.",
    "itemLc116": "17.01",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "170201",
    "descricao": "Datilografia, digitação, estenografia e congêneres.",
    "itemLc116": "17.02",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "170202",
    "descricao": "Expediente, secretaria em geral, apoio e infra-estrutura administrativa e congêneres.",
    "itemLc116": "17.02",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "170203",
    "descricao": "Resposta audível e congêneres.",
    "itemLc116": "17.02",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "170204",
    "descricao": "Redação, edição, revisão e congêneres.",
    "itemLc116": "17.02",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "170205",
    "descricao": "Interpretação, tradução e congêneres.",
    "itemLc116": "17.02",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "170301",
    "descricao": "Planejamento, coordenação, programação ou organização técnica.",
    "itemLc116": "17.03",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "170302",
    "descricao": "Planejamento, coordenação, programação ou organização financeira.",
    "itemLc116": "17.03",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "170303",
    "descricao": "Planejamento, coordenação, programação ou organização administrativa.",
    "itemLc116": "17.03",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "170401",
    "descricao": "Recrutamento, agenciamento, seleção e colocação de mão-de-obra.",
    "itemLc116": "17.04",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "170501",
    "descricao": "Fornecimento de mão-de-obra, mesmo em caráter temporário, inclusive de empregados ou trabalhadores, avulsos ou temporários, contratados pelo prestador de serviço.",
    "itemLc116": "17.05",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "170601",
    "descricao": "Propaganda e publicidade, inclusive promoção de vendas, planejamento de campanhas ou sistemas de publicidade, elaboração de desenhos, textos e demais materiais publicitários.",
    "itemLc116": "17.06",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "170801",
    "descricao": "Franquia (franchising).",
    "itemLc116": "17.08",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "170901",
    "descricao": "Perícias, laudos, exames técnicos e análises técnicas.",
    "itemLc116": "17.09",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "171001",
    "descricao": "Planejamento, organização e administração de feiras, exposições, e congêneres.",
    "itemLc116": "17.10",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "171002",
    "descricao": "Planejamento, organização e administração de congressos e congêneres.",
    "itemLc116": "17.10",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "171101",
    "descricao": "Organização de festas e recepções.",
    "itemLc116": "17.11",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "171102",
    "descricao": "Bufê (exceto o fornecimento de alimentação e bebidas, que fica sujeito ao ICMS).",
    "itemLc116": "17.11",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "171201",
    "descricao": "Administração em geral, inclusive de bens e negócios de terceiros.",
    "itemLc116": "17.12",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "171301",
    "descricao": "Leilão e congêneres.",
    "itemLc116": "17.13",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "171401",
    "descricao": "Advocacia",
    "itemLc116": "17.14",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "171501",
    "descricao": "Arbitragem de qualquer espécie, inclusive jurídica.",
    "itemLc116": "17.15",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "171601",
    "descricao": "Auditoria.",
    "itemLc116": "17.16",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "171701",
    "descricao": "Análise de Organização e Métodos.",
    "itemLc116": "17.17",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "171801",
    "descricao": "Atuária e cálculos técnicos de qualquer natureza.",
    "itemLc116": "17.18",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "171901",
    "descricao": "Contabilidade, inclusive serviços técnicos e auxiliares.",
    "itemLc116": "17.19",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "172001",
    "descricao": "Consultoria e assessoria econômica ou financeira.",
    "itemLc116": "17.20",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "172101",
    "descricao": "Estatística.",
    "itemLc116": "17.21",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "172201",
    "descricao": "Cobrança em geral.",
    "itemLc116": "17.22",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "172301",
    "descricao": "Assessoria, análise, avaliação, atendimento, consulta, cadastro, seleção, gerenciamento de informações, administração de contas a receber ou a pagar e em geral, relacionados a operações de faturização (factoring).",
    "itemLc116": "17.23",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "172401",
    "descricao": "Apresentação de palestras, conferências, seminários e congêneres.",
    "itemLc116": "17.24",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "172501",
    "descricao": "Inserção de textos, desenhos e outros materiais de propaganda e publicidade, em qualquer meio (exceto em livros, jornais, periódicos e nas modalidades de serviços de radiodifusão sonora e de sons e imagens de recepção livre e gratuita).",
    "itemLc116": "17.25",
    "grupo": "17",
    "grupoDescricao": "Consultoria, Gestão, Marketing e Apoio"
  },
  {
    "codigo": "180101",
    "descricao": "Serviços de regulação de sinistros vinculados a contratos de seguros e congêneres.",
    "itemLc116": "18.01",
    "grupo": "18",
    "grupoDescricao": "Perícias e Seguros"
  },
  {
    "codigo": "180102",
    "descricao": "Serviços de inspeção e avaliação de riscos para cobertura de contratos de seguros e congêneres.",
    "itemLc116": "18.01",
    "grupo": "18",
    "grupoDescricao": "Perícias e Seguros"
  },
  {
    "codigo": "180103",
    "descricao": "Serviços de prevenção e gerência de riscos seguráveis e congêneres.",
    "itemLc116": "18.01",
    "grupo": "18",
    "grupoDescricao": "Perícias e Seguros"
  },
  {
    "codigo": "190101",
    "descricao": "Serviços de distribuição e venda de bilhetes e demais produtos de loteria, cartões, pules ou cupons de apostas, sorteios, prêmios, inclusive os decorrentes de títulos de capitalização e congêneres.",
    "itemLc116": "19.01",
    "grupo": "19",
    "grupoDescricao": "Títulos e Valores Mobiliários"
  },
  {
    "codigo": "190102",
    "descricao": "Serviços de distribuição e venda de bingos e congêneres.",
    "itemLc116": "19.01",
    "grupo": "19",
    "grupoDescricao": "Títulos e Valores Mobiliários"
  },
  {
    "codigo": "200101",
    "descricao": "Serviços portuários, ferroportuários, utilização de porto, movimentação de passageiros, reboque de embarcações, rebocador escoteiro, atracação, desatracação, serviços de praticagem, capatazia, armazenagem de qualquer natureza, serviços acessórios, movimentação de mercadorias, serviços de apoio marítimo, de movimentação ao largo, serviços de armadores, estiva, conferência, logística e congêneres. (prestado em terra)",
    "itemLc116": "20.01",
    "grupo": "20",
    "grupoDescricao": "Portos, Aeroportos e Terminais"
  },
  {
    "codigo": "200102",
    "descricao": "Serviços portuários, ferroportuários, utilização de porto, movimentação de passageiros, reboque de embarcações, rebocador escoteiro, atracação, desatracação, serviços de praticagem, capatazia, armazenagem de qualquer natureza, serviços acessórios, movimentação de mercadorias, serviços de apoio marítimo, de movimentação ao largo, serviços de armadores, estiva, conferência, logística e congêneres. (prestado em águas marinhas)",
    "itemLc116": "20.01",
    "grupo": "20",
    "grupoDescricao": "Portos, Aeroportos e Terminais"
  },
  {
    "codigo": "200201",
    "descricao": "Serviços aeroportuários, utilização de aeroporto, movimentação de passageiros, armazenagem de qualquer natureza, capatazia, movimentação de aeronaves, serviços de apoio aeroportuários, serviços acessórios, movimentação de mercadorias, logística e congêneres.",
    "itemLc116": "20.02",
    "grupo": "20",
    "grupoDescricao": "Portos, Aeroportos e Terminais"
  },
  {
    "codigo": "200301",
    "descricao": "Serviços de terminais rodoviários, ferroviários, metroviários, movimentação de passageiros, mercadorias, inclusive suas operações, logística e congêneres.",
    "itemLc116": "20.03",
    "grupo": "20",
    "grupoDescricao": "Portos, Aeroportos e Terminais"
  },
  {
    "codigo": "210101",
    "descricao": "Serviços de registros públicos, cartorários e notariais.",
    "itemLc116": "21.01",
    "grupo": "21",
    "grupoDescricao": "Serviços Notariais e Registro"
  },
  {
    "codigo": "220101",
    "descricao": "Serviços de exploração de rodovia mediante cobrança de preço ou pedágio dos usuários, envolvendo execução de serviços de conservação, manutenção, melhoramentos para adequação de capacidade e segurança de trânsito, operação, monitoração, assistência aos usuários e outros serviços definidos em contratos, atos de concessão ou de permissão ou em normas oficiais.",
    "itemLc116": "22.01",
    "grupo": "22",
    "grupoDescricao": "Operação de Rodovias"
  },
  {
    "codigo": "230101",
    "descricao": "Serviços de programação e comunicação visual e congêneres.",
    "itemLc116": "23.01",
    "grupo": "23",
    "grupoDescricao": "Design Industrial e Embalagens"
  },
  {
    "codigo": "230102",
    "descricao": "Serviços de desenho industrial e congêneres.",
    "itemLc116": "23.01",
    "grupo": "23",
    "grupoDescricao": "Design Industrial e Embalagens"
  },
  {
    "codigo": "240101",
    "descricao": "Serviços de chaveiros, confecção de carimbos e congêneres.",
    "itemLc116": "24.01",
    "grupo": "24",
    "grupoDescricao": "Serviços Pessoais Diversos"
  },
  {
    "codigo": "240102",
    "descricao": "Serviços de placas, sinalização visual, banners, adesivos e congêneres.",
    "itemLc116": "24.01",
    "grupo": "24",
    "grupoDescricao": "Serviços Pessoais Diversos"
  },
  {
    "codigo": "250101",
    "descricao": "Funerais, inclusive fornecimento de caixão, urna ou esquifes; aluguel de capela; transporte do corpo cadavérico; fornecimento de flores, coroas e outros paramentos; desembaraço de certidão de óbito; fornecimento de véu, essa e outros adornos; embalsamento, embelezamento, conservação ou restauração de cadáveres.",
    "itemLc116": "25.01",
    "grupo": "25",
    "grupoDescricao": "Serviços Funerários e Cremação"
  },
  {
    "codigo": "250201",
    "descricao": "Translado intramunicipal de corpos e partes de corpos cadavéricos.",
    "itemLc116": "25.02",
    "grupo": "25",
    "grupoDescricao": "Serviços Funerários e Cremação"
  },
  {
    "codigo": "250202",
    "descricao": "Cremação de corpos e partes de corpos cadavéricos.",
    "itemLc116": "25.02",
    "grupo": "25",
    "grupoDescricao": "Serviços Funerários e Cremação"
  },
  {
    "codigo": "250301",
    "descricao": "Planos ou convênio funerários.",
    "itemLc116": "25.03",
    "grupo": "25",
    "grupoDescricao": "Serviços Funerários e Cremação"
  },
  {
    "codigo": "250401",
    "descricao": "Manutenção e conservação de jazigos e cemitérios.",
    "itemLc116": "25.04",
    "grupo": "25",
    "grupoDescricao": "Serviços Funerários e Cremação"
  },
  {
    "codigo": "250501",
    "descricao": "Cessão de uso de espaços em cemitérios para sepultamento.",
    "itemLc116": "25.05",
    "grupo": "25",
    "grupoDescricao": "Serviços Funerários e Cremação"
  },
  {
    "codigo": "260101",
    "descricao": "Serviços de coleta, remessa ou entrega de correspondências, documentos, objetos, bens ou valores, inclusive pelos correios e suas agências franqueadas.",
    "itemLc116": "26.01",
    "grupo": "26",
    "grupoDescricao": "Transporte de Encomendas e Malotes"
  },
  {
    "codigo": "260102",
    "descricao": "Serviços de courrier e congêneres.",
    "itemLc116": "26.01",
    "grupo": "26",
    "grupoDescricao": "Transporte de Encomendas e Malotes"
  },
  {
    "codigo": "270101",
    "descricao": "Serviços de assistência social.",
    "itemLc116": "27.01",
    "grupo": "27",
    "grupoDescricao": "Reabilitação e Assistência Social"
  },
  {
    "codigo": "280101",
    "descricao": "Serviços de avaliação de bens e serviços de qualquer natureza.",
    "itemLc116": "28.01",
    "grupo": "28",
    "grupoDescricao": "Recursos Naturais e Meio Ambiente"
  },
  {
    "codigo": "290101",
    "descricao": "Serviços de biblioteconomia.",
    "itemLc116": "29.01",
    "grupo": "29",
    "grupoDescricao": "Bibliotecas e Documentação"
  },
  {
    "codigo": "300101",
    "descricao": "Serviços de biologia e biotecnologia.",
    "itemLc116": "30.01",
    "grupo": "30",
    "grupoDescricao": "Serviços Profissionais Científicos"
  },
  {
    "codigo": "300102",
    "descricao": "Serviços de química.",
    "itemLc116": "30.01",
    "grupo": "30",
    "grupoDescricao": "Serviços Profissionais Científicos"
  },
  {
    "codigo": "310101",
    "descricao": "Serviços técnicos em edificações e congêneres.",
    "itemLc116": "31.01",
    "grupo": "31",
    "grupoDescricao": "Serviços Técnicos e Imobiliários"
  },
  {
    "codigo": "310102",
    "descricao": "Serviços técnicos em eletrônica, eletrotécnica e congêneres.",
    "itemLc116": "31.01",
    "grupo": "31",
    "grupoDescricao": "Serviços Técnicos e Imobiliários"
  },
  {
    "codigo": "310103",
    "descricao": "Serviços técnicos em mecânica e congêneres.",
    "itemLc116": "31.01",
    "grupo": "31",
    "grupoDescricao": "Serviços Técnicos e Imobiliários"
  },
  {
    "codigo": "310104",
    "descricao": "Serviços técnicos em telecomunicações e congêneres.",
    "itemLc116": "31.01",
    "grupo": "31",
    "grupoDescricao": "Serviços Técnicos e Imobiliários"
  },
  {
    "codigo": "320101",
    "descricao": "Serviços de desenhos técnicos.",
    "itemLc116": "32.01",
    "grupo": "32",
    "grupoDescricao": "Design e Comunicação Visual"
  },
  {
    "codigo": "330101",
    "descricao": "Serviços de desembaraço aduaneiro, comissários, despachantes e congêneres.",
    "itemLc116": "33.01",
    "grupo": "33",
    "grupoDescricao": "Despacho Aduaneiro e Comércio Exterior"
  },
  {
    "codigo": "340101",
    "descricao": "Serviços de investigações particulares, detetives e congêneres.",
    "itemLc116": "34.01",
    "grupo": "34",
    "grupoDescricao": "Investigação Privada e Segurança"
  },
  {
    "codigo": "350101",
    "descricao": "Serviços de reportagem e jornalismo.",
    "itemLc116": "35.01",
    "grupo": "35",
    "grupoDescricao": "Assessoria de Imprensa e Mídia"
  },
  {
    "codigo": "350102",
    "descricao": "Serviços de assessoria de imprensa.",
    "itemLc116": "35.01",
    "grupo": "35",
    "grupoDescricao": "Assessoria de Imprensa e Mídia"
  },
  {
    "codigo": "350103",
    "descricao": "Serviços de relações públicas.",
    "itemLc116": "35.01",
    "grupo": "35",
    "grupoDescricao": "Assessoria de Imprensa e Mídia"
  },
  {
    "codigo": "360101",
    "descricao": "Serviços de meteorologia.",
    "itemLc116": "36.01",
    "grupo": "36",
    "grupoDescricao": "Meteorologia e Clima"
  },
  {
    "codigo": "370101",
    "descricao": "Serviços de artistas, atletas, modelos e manequins.",
    "itemLc116": "37.01",
    "grupo": "37",
    "grupoDescricao": "Agenciamento Artístico e Modelos"
  },
  {
    "codigo": "380101",
    "descricao": "Serviços de museologia.",
    "itemLc116": "38.01",
    "grupo": "38",
    "grupoDescricao": "Museus e Patrimônio"
  },
  {
    "codigo": "390101",
    "descricao": "Serviços de ourivesaria e lapidação (quando o material for fornecido pelo tomador do serviço).",
    "itemLc116": "39.01",
    "grupo": "39",
    "grupoDescricao": "Joalheria e Lapidação"
  },
  {
    "codigo": "400101",
    "descricao": "Obras de arte sob encomenda.",
    "itemLc116": "40.01",
    "grupo": "40",
    "grupoDescricao": "Autores, Compositores e Artistas Plásticos"
  },
  {
    "codigo": "990101",
    "descricao": "Serviços sem a incidência de ISSQN e ICMS",
    "itemLc116": "99.01",
    "grupo": "99",
    "grupoDescricao": "Serviços Não Tributáveis / Imunes / Sem Incidência"
  }
];
