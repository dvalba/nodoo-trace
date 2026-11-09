import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-guide',
  imports: [RouterLink],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-semibold tracking-tight">Guía rápida</h1>
        <p class="text-sm text-mut mt-1">
          Todo lo necesario para entender y usar NodooTrace desde cero.
        </p>
      </div>

      <section class="card">
        <h2 class="text-sm font-semibold">El flujo en 5 pasos</h2>
        <ol class="steps">
          <li>
            <span class="num">1</span>
            <div>
              <div class="step-title">Configura qué hace tu empresa</div>
              <p class="step-text">
                Marcas tus operaciones y el sistema te sugiere una actividad
                (fabricante, distribuidor, etc.) o creas la tuya. Esa actividad
                define qué acciones puedes ejecutar.
              </p>
            </div>
          </li>
          <li>
            <span class="num">2</span>
            <div>
              <div class="step-title">Crea un producto y un lote</div>
              <p class="step-text">
                El producto es el catálogo (ej. vacuna antigripal). El lote
                agrupa las unidades fabricadas juntas (ej. LOTE-VAC-2026-01).
              </p>
              <a routerLink="/products" class="link">Ir a Productos</a>
            </div>
          </li>
          <li>
            <span class="num">3</span>
            <div>
              <div class="step-title">Genera casos trazables</div>
              <p class="step-text">
                Cada caso es una caja con un identificador único (EPC). Es la
                unidad que se mueve, se rastrea y se audita. Los pallets no se
                serializan: solo agrupan cajas.
              </p>
              <a routerLink="/products" class="link">Generar casos</a>
            </div>
          </li>
          <li>
            <span class="num">4</span>
            <div>
              <div class="step-title">Mueve y factura los casos</div>
              <p class="step-text">
                Envía un caso, recíbelo como custodio y emite la factura para
                transferir la propiedad. Cada acción queda en el historial.
              </p>
              <a routerLink="/trace" class="link">Ir a Trazabilidad</a>
            </div>
          </li>
          <li>
            <span class="num">5</span>
            <div>
              <div class="step-title">Consulta y avisa</div>
              <p class="step-text">
                Revisa el historial completo de un caso. Si hay un problema,
                publica un aviso o retiro y recoge los reconocimientos de los
                afectados.
              </p>
              <a routerLink="/notices" class="link">Ir a Avisos</a>
            </div>
          </li>
        </ol>
      </section>

      <section class="card">
        <h2 class="text-sm font-semibold mb-3">Glosario</h2>
        <div class="glossary">
          <div class="term">
            <div class="term-name">Organización (actor)</div>
            <p class="step-text">
              Tu empresa dentro de la plataforma. Tiene un propietario y puede
              tener más miembros.
            </p>
          </div>
          <div class="term">
            <div class="term-name">Actividad</div>
            <p class="step-text">
              El papel de tu empresa en la cadena: fabricante, distribuidor,
              transportista, hospital, etc.
            </p>
          </div>
          <div class="term">
            <div class="term-name">Operación</div>
            <p class="step-text">
              Una acción concreta que puedes hacer: comisionar, enviar, recibir,
              facturar, transformar…
            </p>
          </div>
          <div class="term">
            <div class="term-name">Producto</div>
            <p class="step-text">
              Lo que tu empresa fabrica o distribuye, identificado por un SKU.
            </p>
          </div>
          <div class="term">
            <div class="term-name">Lote</div>
            <p class="step-text">
              Un grupo de unidades producidas en las mismas condiciones.
            </p>
          </div>
          <div class="term">
            <div class="term-name">Caso / EPC</div>
            <p class="step-text">
              La unidad trazable (una caja) con un identificador único. Es lo
              que consultas y mueves.
            </p>
          </div>
          <div class="term">
            <div class="term-name">Pallet</div>
            <p class="step-text">
              Unidad logística que agrupa cajas. En esta demo no tiene EPC ni
              historial propio.
            </p>
          </div>
          <div class="term">
            <div class="term-name">Evento</div>
            <p class="step-text">
              Cada acción registrada sobre un caso: comisión, envío, recepción,
              factura, etc.
            </p>
          </div>
          <div class="term">
            <div class="term-name">Custodio</div>
            <p class="step-text">
              Quién tiene físicamente el caso en un momento dado.
            </p>
          </div>
          <div class="term">
            <div class="term-name">Propietario</div>
            <p class="step-text">
              Quién es dueño del caso. Cambia al facturar con transferencia de
              propiedad.
            </p>
          </div>
          <div class="term">
            <div class="term-name">Aviso / retiro</div>
            <p class="step-text">
              Alerta sobre un producto, lote o caso. Los afectados deben
              reconocerla.
            </p>
          </div>
        </div>
      </section>

      <div class="callout">
        <strong>Regla de oro:</strong> solo puedes ejecutar las operaciones que
        habilitaste al configurar tu actividad. Si una acción no aparece, revisa
        la configuración con el administrador de tu organización.
      </div>
    </div>
  `,
  styles: `
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      padding: 1.25rem;
      box-shadow: 0 1px 2px rgb(16 24 40 / 0.04);
    }
    .steps {
      list-style: none;
      padding: 0;
      margin: 1rem 0 0;
      display: grid;
      gap: 0.9rem;
    }
    .steps li {
      display: flex;
      gap: 0.75rem;
      align-items: flex-start;
      padding-bottom: 0.9rem;
      border-bottom: 1px solid var(--color-border);
    }
    .steps li:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }
    .num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.7rem;
      height: 1.7rem;
      border-radius: 9999px;
      background: var(--color-accent);
      color: var(--color-accent-ink);
      font-weight: 700;
      font-size: 0.8rem;
      flex: none;
    }
    .step-title {
      font-size: 0.9rem;
      font-weight: 600;
    }
    .step-text {
      font-size: 0.83rem;
      color: var(--color-mut);
      margin-top: 0.15rem;
      line-height: 1.45;
    }
    .link {
      display: inline-block;
      margin-top: 0.3rem;
      font-size: 0.8rem;
      color: var(--color-accent);
      text-decoration: none;
    }
    .link:hover {
      text-decoration: underline;
    }
    .glossary {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
    }
    .term {
      padding: 0.75rem;
      border: 1px solid var(--color-border);
      border-radius: 0.55rem;
      background: var(--color-surface-2);
    }
    .term-name {
      font-size: 0.85rem;
      font-weight: 600;
    }
    .callout {
      padding: 0.9rem 1rem;
      border-radius: 0.65rem;
      border: 1px solid color-mix(in srgb, var(--color-accent) 28%, var(--color-border));
      background: color-mix(in srgb, var(--color-accent) 7%, var(--color-surface));
      font-size: 0.85rem;
      color: var(--color-ink);
    }
  `,
})
export class Guide {}
