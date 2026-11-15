import React from "react"
import Image from "next/image"
import { Phone, MapPin, Clock, ShieldCheck, Award, ExternalLink } from "lucide-react"

export function Rodape() {
  return (
    <footer className="bg-slate-950 text-slate-300 pt-16 pb-12 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Coluna 1: Sobre */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 shrink-0">
                <Image
                  src="/brand/logo-simbolo.png"
                  alt="Toldos Print"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-black text-white">
                TOLDOS<span className="text-amber-400">PRINT</span>
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Há 35 anos sendo referência em toldos, coberturas em policarbonato, fachadas em ACM e comunicação visual em Águia Branca e todo o Espírito Santo.
            </p>

            <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
              <Award className="w-4 h-4" />
              <span>35 Anos de Histórias e Confiança</span>
            </div>
          </div>

          {/* Coluna 2: Produtos */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-white uppercase tracking-wider">
              Nossos Serviços
            </h4>
            <ul className="text-xs space-y-2 text-slate-400">
              <li><a href="#toldos-coberturas" className="hover:text-amber-400 transition-colors">Toldos Fixos e Cortina Retrátil</a></li>
              <li><a href="#toldos-coberturas" className="hover:text-amber-400 transition-colors">Coberturas de Policarbonato</a></li>
              <li><a href="#fachadas-letras" className="hover:text-amber-400 transition-colors">Fachadas Modernas em ACM</a></li>
              <li><a href="#fachadas-letras" className="hover:text-amber-400 transition-colors">Letras Caixa 3D com LED</a></li>
              <li><a href="#comunicacao-visual" className="hover:text-amber-400 transition-colors">Banners, Faixas e Outdoors</a></li>
              <li><a href="#materiais" className="hover:text-amber-400 transition-colors">Venda de Materiais para Comunicação</a></li>
            </ul>
          </div>

          {/* Coluna 3: Atendimento e Localização */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-white uppercase tracking-wider">
              Atendimento & Fábrica
            </h4>
            <div className="text-xs space-y-2.5 text-slate-400">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>Av. João Quiuqui, Centro – Águia Branca - ES</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>(27) 99748-9714 / (27) 99612-5835</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Segunda a Sexta: 07h às 17h</span>
              </div>
            </div>
          </div>

          {/* Coluna 4: Área da Equipe */}
          <div className="space-y-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
            <h4 className="text-xs font-black text-white uppercase tracking-wider">
              Área Restrita da Equipe
            </h4>
            <p className="text-[11px] text-slate-400">
              Acesso exclusivo para os colaboradores, vendedores e produção da fábrica.
            </p>
            <a
              href="https://sistema.toldosprint.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-colors"
            >
              <span>Acessar Sistema Interno</span>
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
            </a>
          </div>
        </div>

        {/* Linha Inferior */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} TOLDOS PRINT — Todos os direitos reservados.</p>
          <p className="flex items-center gap-1">
            Qualidade, acabamento profissional e durabilidade.
          </p>
        </div>
      </div>
    </footer>
  )
}
