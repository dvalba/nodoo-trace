import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import jsQR from 'jsqr';
import { toDataURL } from 'qrcode';
import { Api } from '../../core/api.service';
import { Auth } from '../../core/auth.service';
import { Directory } from '../../core/directory.service';
import type {
  ActorSummary,
  Batch,
  BizStep,
  BizTransactionType,
  Epc,
  EpcHistoryEntry,
  EpcSearchResult,
  EpcStatus,
  EventEpcRole,
  EventType,
  Notice,
  Product,
} from '../../core/models';

const STATUS_STYLES: Record<EpcStatus, string> = {
  active: '#5ec88a',
  in_transit: '#6aa9e8',
  in_progress: '#e0b458',
  consumed: '#8a97ad',
  damaged: '#f08a8a',
  expired: '#c98ad6',
};

const TYPE_LABELS: Record<EventType, string> = {
  ObjectEvent: 'Objeto',
  AggregationEvent: 'Agregación',
  TransactionEvent: 'Transacción',
  TransformationEvent: 'Transformación',
  AssociationEvent: 'Asociación',
};

const STATUS_LABELS: Record<EpcStatus, string> = {
  active: 'Activo',
  in_transit: 'En tránsito',
  in_progress: 'En proceso',
  consumed: 'Consumido',
  damaged: 'Dañado',
  expired: 'Vencido',
};

const ROLE_LABELS: Record<EventEpcRole, string> = {
  observed: 'Observado',
  parent: 'Contenedor',
  child: 'Contenido',
  input: 'Entrada',
  output: 'Salida',
  source: 'Origen',
  associated: 'Asociado',
};

const BIZ_STEP_LABELS: Record<BizStep, string> = {
  commissioning: 'Comisionamiento',
  receiving: 'Recepción',
  shipping: 'Envío',
  packing: 'Empaquetado',
  unpacking: 'Desempaquetado',
  transforming: 'Transformación',
  inspecting: 'Inspección',
};

const BIZ_TXN_TYPE_LABELS: Record<BizTransactionType, string> = {
  po: 'Orden de compra',
  inv: 'Factura',
  desadv: 'Aviso de despacho',
  bol: 'Guía de remisión',
};

interface SearchItem {
  product: Product;
  batches: Batch[];
}

@Component({
  selector: 'app-trace',
  imports: [FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-semibold tracking-tight">Trazabilidad</h1>
        <p class="text-sm text-mut mt-1">
          Un caso es la caja que quieres rastrear. Consulta su estado, su
          historial completo y los avisos que le afectan. Si no sabes el EPC,
          búscalo por SKU o lote o elígelo en «Mis casos».
        </p>
      </div>

      <div class="card">
        <div class="flex flex-wrap gap-3 items-end">
          <div class="flex-1 min-w-[240px]">
            <label class="block text-sm mb-1" for="epc">
              EPC, SKU, nombre o lote
            </label>
            <input
              id="epc"
              [(ngModel)]="query"
              (keyup.enter)="lookup()"
              class="field font-mono text-xs"
              placeholder="urn:nodoo:epc:…, SKU, producto o código de lote"
            />
          </div>
          <button
            type="button"
            class="btn-primary"
            [disabled]="busy()"
            (click)="lookup()"
          >
            {{ busy() ? 'Consultando…' : 'Consultar' }}
          </button>
        </div>

        @if (error()) {
          <div class="mt-3 text-sm" style="color: var(--color-danger)">{{ error() }}</div>
        }
      </div>

      @if (canReceive()) {
        <section class="card">
          <h2 class="text-sm font-semibold mb-1">Recibir un caso</h2>
          <p class="text-xs text-mut mb-3">
            Lee la etiqueta física del caso que llega, ingresa su EPC o
            escanéalo con la cámara y confirma la recepción.
          </p>
          <div class="flex flex-wrap gap-3 items-end">
            <div class="flex-1 min-w-[240px]">
              <label class="block text-sm mb-1" for="receiveEpc">
                EPC de la etiqueta
              </label>
              <input
                id="receiveEpc"
                [(ngModel)]="receiveInput"
                (keyup.enter)="receiveByLabel()"
                class="field font-mono text-xs"
                placeholder="urn:nodoo:epc:…"
              />
            </div>
            <button
              type="button"
              class="btn-secondary"
              [disabled]="receiving() || cameraActive()"
              (click)="toggleCamera()"
            >
              {{ cameraActive() ? 'Cerrar cámara' : 'Usar cámara' }}
            </button>
            <button
              type="button"
              class="btn-primary"
              [disabled]="receiving() || cameraActive()"
              (click)="receiveByLabel()"
            >
              {{ receiving() ? 'Procesando…' : 'Recibir caso' }}
            </button>
          </div>

          @if (cameraError()) {
            <div class="mt-3 text-sm" style="color: var(--color-danger)">{{ cameraError() }}</div>
          }

          <video
            #cameraVideo
            class="camera-video"
            [style.display]="cameraActive() ? 'block' : 'none'"
            autoplay
            muted
            playsinline
          ></video>

          @if (receiveError()) {
            <div class="mt-3 text-sm" style="color: var(--color-danger)">{{ receiveError() }}</div>
          }
          @if (receiveMessage()) {
            <div class="mt-3 text-sm" style="color: var(--color-success)">{{ receiveMessage() }}</div>
          }
        </section>
      }

      @if (results().length > 1) {
        <section class="card">
          <h2 class="text-sm font-semibold mb-3">
            Casos coincidentes · {{ results().length }}
          </h2>
          <p class="text-xs text-mut mb-3">
            Tu búsqueda coincide con varios casos. Elige el que quieres
            consultar.
          </p>
          <div class="grid gap-2 md:grid-cols-2">
            @for (item of results(); track item.id) {
              <button type="button" class="case-row" (click)="load(item.id)">
                <span class="flex items-center gap-2">
                  <span class="badge" [style.background]="statusColor(item.status)" [style.color]="'#0b0f17'">
                    {{ statusLabel(item.status) }}
                  </span>
                  <span class="font-mono text-xs">{{ short(item.id) }}</span>
                </span>
                <span class="text-xs text-mut">
                  {{ item.product?.name ?? 'Producto' }}
                  @if (item.product) {
                    · {{ item.product.sku }}
                  }
                  @if (item.batch) {
                    · Lote {{ item.batch.batchCode }}
                  }
                </span>
              </button>
            }
          </div>
        </section>
      }

      @if (searchedItems().length > 0) {
        <section class="card">
          <h2 class="text-sm font-semibold mb-3">
            Existen en tu catálogo, aún sin caso rastreable
          </h2>
          <p class="text-xs text-mut mb-3">
            Estos productos o lotes coinciden con la búsqueda pero todavía no
            tienen un EPC que puedas consultar.
          </p>
          <div class="space-y-2">
            @for (item of searchedItems(); track item.product.id) {
              <div class="case-row-static">
                <span class="text-sm">
                  {{ item.product.name }}
                  <span class="text-mut">· {{ item.product.sku }}</span>
                </span>
                <span class="text-xs text-mut">
                  @if (item.batches.length > 0) {
                    Lotes: {{ item.batches.map((b) => b.batchCode).join(', ') }}
                  } @else {
                    Sin lotes
                  }
                </span>
              </div>
            }
          </div>
        </section>
      }

      <section class="card">
        <h2 class="text-sm font-semibold mb-3">
          Mis casos · {{ myCases().length }}
        </h2>
        @if (myCases().length === 0) {
          <p class="text-sm text-mut">
            Aún no tienes casos. Genera casos desde la página de Productos.
          </p>
        } @else {
          <div class="grid gap-2 md:grid-cols-2">
            @for (item of myCases(); track item.id) {
              <button type="button" class="case-row" (click)="load(item.id)">
                <span class="flex items-center gap-2">
                  <span class="badge" [style.background]="statusColor(item.status)" [style.color]="'#0b0f17'">
                    {{ statusLabel(item.status) }}
                  </span>
                  <span class="font-mono text-xs">{{ short(item.id) }}</span>
                </span>
                <span class="text-xs text-mut">
                  {{ item.product?.name ?? 'Producto' }}
                  @if (item.batch) {
                    · {{ item.batch.batchCode }}
                  }
                </span>
              </button>
            }
          </div>
        }
      </section>

      @let twin = epc();
      @if (twin) {
        <div class="grid gap-6 lg:grid-cols-3">
          <div class="lg:col-span-1 space-y-6">
            <section class="card">
              <div class="flex items-center justify-between mb-4">
                <h2 class="text-sm font-semibold">Gemelo digital</h2>
                <span
                  class="badge"
                  [style.background]="statusColor(twin.status)"
                  [style.color]="'#0b0f17'"
                >
                  {{ statusLabel(twin.status) }}
                </span>
              </div>

              <dl class="space-y-3 text-sm">
                <div>
                  <dt class="text-mut text-xs">Producto</dt>
                  <dd class="mt-0.5">
                    {{ twin.product?.name ?? '—' }}
                    @if (twin.product) {
                      <span class="text-mut"> · {{ twin.product.sku }}</span>
                    }
                  </dd>
                </div>
                <div>
                  <dt class="text-mut text-xs">Lote</dt>
                  <dd class="mt-0.5">{{ twin.batch?.batchCode ?? '—' }}</dd>
                </div>
                <div>
                  <dt class="text-mut text-xs">Productor</dt>
                  <dd class="mt-0.5">{{ actorLabel(twin.producerActorId) }}</dd>
                </div>
                <div>
                  <dt class="text-mut text-xs">Propietario</dt>
                  <dd class="mt-0.5">{{ actorLabel(twin.ownerActorId) }}</dd>
                </div>
                <div>
                  <dt class="text-mut text-xs">Custodio</dt>
                  <dd class="mt-0.5">{{ actorLabel(twin.custodianActorId) }}</dd>
                </div>
                @if (twin.destinationActorId) {
                  <div>
                    <dt class="text-mut text-xs">Destino</dt>
                    <dd class="mt-0.5">{{ actorLabel(twin.destinationActorId) }}</dd>
                  </div>
                }
                @if (twin.parentId) {
                  <div>
                    <dt class="text-mut text-xs">Contenedor</dt>
                    <dd class="mt-0.5 font-mono text-xs">{{ short(twin.parentId) }}</dd>
                  </div>
                }
                <div>
                  <dt class="text-mut text-xs">Comisionado</dt>
                  <dd class="mt-0.5">{{ date(twin.commissionedAt) }}</dd>
                </div>
              </dl>

              <div class="mt-4 pt-3 border-t border-border">
                <div class="text-xs text-mut break-all font-mono">{{ twin.id }}</div>
                @if (qrUrl()) {
                  <div class="mt-3 flex items-center gap-3">
                    <img
                      id="qrLabel"
                      [src]="qrUrl() ?? ''"
                      alt="Etiqueta QR del caso"
                      class="h-32 w-32 rounded border border-border bg-white p-1"
                    />
                    <a
                      id="qrDownload"
                      [href]="qrUrl() ?? ''"
                      [download]="'etiqueta-' + short(twin.id) + '.png'"
                      class="text-xs text-accent no-underline hover:underline"
                    >
                      Descargar etiqueta
                    </a>
                  </div>
                }
              </div>
            </section>

            @if (anyAction()) {
              <section class="card">
                <h2 class="text-sm font-semibold mb-1">Acciones disponibles</h2>
                <p class="text-xs text-mut mb-4">
                  Solo se muestran las acciones que tu actividad permite y que
                  corresponden al estado actual del caso.
                </p>

                @if (canShip() || canReceive() || canInvoice() || canPo() || canDesadv() || canBol()) {
                  <div class="space-y-4">
                    <h3 class="text-xs font-semibold text-mut uppercase tracking-wide">Movimiento</h3>

                    @if (canShip()) {
                      <div class="space-y-2">
                        <label class="block text-sm" for="shipDest">Enviar a</label>
                        <select id="shipDest" [(ngModel)]="shipDestination" class="field">
                          <option value="">— Elige una organización —</option>
                          @for (dest of shipDestinations; track dest.id) {
                            <option [value]="dest.id">{{ dest.name }}</option>
                          }
                        </select>
                        <button type="button" class="btn-primary" [disabled]="acting() || !shipDestination" (click)="ship()">
                          {{ acting() ? 'Procesando…' : 'Enviar caso' }}
                        </button>
                      </div>
                    }

                    @if (canInvoice()) {
                      <div class="space-y-2">
                        <label class="block text-sm" for="invoiceNumber">Facturar</label>
                        <input
                          id="invoiceNumber"
                          [(ngModel)]="invoiceNumber"
                          name="invoiceNumber"
                          class="field"
                          placeholder="Nº de factura, ej. INV-2026-0004"
                        />
                        <input
                          [(ngModel)]="invoiceRecipient"
                          name="invoiceRecipient"
                          class="field"
                          placeholder="UUID del nuevo propietario (opcional)"
                        />
                        <button type="button" class="btn-primary" [disabled]="acting()" (click)="invoice()">
                          {{ acting() ? 'Procesando…' : 'Registrar factura' }}
                        </button>
                      </div>
                    }

                    @if (canPo()) {
                      <div class="space-y-2">
                        <label class="block text-sm" for="poNumber">Orden de compra</label>
                        <input
                          id="poNumber"
                          [(ngModel)]="poNumber"
                          name="poNumber"
                          class="field"
                          placeholder="Nº de orden de compra, ej. PO-2026-001"
                        />
                        <button type="button" class="btn-primary" [disabled]="acting()" (click)="purchaseOrder()">
                          {{ acting() ? 'Procesando…' : 'Registrar orden de compra' }}
                        </button>
                      </div>
                    }

                    @if (canDesadv()) {
                      <div class="space-y-2">
                        <label class="block text-sm" for="desadvNumber">Aviso de despacho</label>
                        <input
                          id="desadvNumber"
                          [(ngModel)]="desadvNumber"
                          name="desadvNumber"
                          class="field"
                          placeholder="Nº de aviso de despacho"
                        />
                        <button type="button" class="btn-primary" [disabled]="acting()" (click)="despatchAdvice()">
                          {{ acting() ? 'Procesando…' : 'Registrar aviso de despacho' }}
                        </button>
                      </div>
                    }

                    @if (canBol()) {
                      <div class="space-y-2">
                        <label class="block text-sm" for="bolNumber">Guía de remisión</label>
                        <input
                          id="bolNumber"
                          [(ngModel)]="bolNumber"
                          name="bolNumber"
                          class="field"
                          placeholder="Nº de guía de remisión"
                        />
                        <button type="button" class="btn-primary" [disabled]="acting()" (click)="billOfLading()">
                          {{ acting() ? 'Procesando…' : 'Registrar guía de remisión' }}
                        </button>
                      </div>
                    }
                  </div>
                }

                @if (canInspect()) {
                  <div class="space-y-4 mt-4 pt-4 border-t border-border">
                    <h3 class="text-xs font-semibold text-mut uppercase tracking-wide">Calidad</h3>
                    <div class="space-y-2">
                      <span class="block text-sm">Inspeccionar</span>
                      <label class="flex items-center gap-2 text-sm">
                        <input type="radio" name="inspectResult" value="passed" [(ngModel)]="inspectionResult" />
                        Conforme
                      </label>
                      <label class="flex items-center gap-2 text-sm">
                        <input type="radio" name="inspectResult" value="failed" [(ngModel)]="inspectionResult" />
                        No conforme
                      </label>
                      <button type="button" class="btn-primary" [disabled]="acting()" (click)="inspect()">
                        {{ acting() ? 'Procesando…' : 'Registrar inspección' }}
                      </button>
                    </div>
                  </div>
                }

                @if (canPack() || canUnpack()) {
                  <div class="space-y-4 mt-4 pt-4 border-t border-border">
                    <h3 class="text-xs font-semibold text-mut uppercase tracking-wide">Empaquetado</h3>

                    @if (canPack()) {
                      <div class="space-y-2">
                        <label class="block text-sm" for="packSel">Empacar casos en este contenedor</label>
                        <select id="packSel" multiple size="4" class="field" [(ngModel)]="packSelection">
                          @for (cand of packCandidates(); track cand.id) {
                            <option [value]="cand.id">
                              {{ short(cand.id) }} · {{ cand.product?.name ?? '' }}
                            </option>
                          }
                        </select>
                        <p class="text-xs text-mut">Mantén Ctrl/Cmd para seleccionar varios.</p>
                        <button type="button" class="btn-primary" [disabled]="acting() || packSelection.length === 0" (click)="pack()">
                          {{ acting() ? 'Procesando…' : 'Empacar' }}
                        </button>
                      </div>
                    }

                    @if (canUnpack()) {
                      <div class="space-y-2">
                        <label class="block text-sm" for="unpackSel">Quitar casos de este contenedor</label>
                        <select id="unpackSel" multiple size="4" class="field" [(ngModel)]="unpackSelection">
                          @for (cand of unpackChildren(); track cand.id) {
                            <option [value]="cand.id">
                              {{ short(cand.id) }} · {{ cand.product?.name ?? '' }}
                            </option>
                          }
                        </select>
                        <button type="button" class="btn-primary" [disabled]="acting() || unpackSelection.length === 0" (click)="unpack()">
                          {{ acting() ? 'Procesando…' : 'Desempaquetar' }}
                        </button>
                      </div>
                    }
                  </div>
                }

                @if (canAssociate() || canDisassociate()) {
                  <div class="space-y-4 mt-4 pt-4 border-t border-border">
                    <h3 class="text-xs font-semibold text-mut uppercase tracking-wide">Asociaciones</h3>

                    @if (canAssociate()) {
                      <div class="space-y-2">
                        <label class="block text-sm" for="assocSel">Asociar casos relacionados</label>
                        <select id="assocSel" multiple size="4" class="field" [(ngModel)]="associateSelection">
                          @for (cand of associateCandidates(); track cand.id) {
                            <option [value]="cand.id">
                              {{ short(cand.id) }} · {{ cand.product?.name ?? '' }}
                            </option>
                          }
                        </select>
                        <button type="button" class="btn-primary" [disabled]="acting() || associateSelection.length === 0" (click)="associate()">
                          {{ acting() ? 'Procesando…' : 'Asociar' }}
                        </button>
                      </div>
                    }

                    @if (canDisassociate()) {
                      <div class="space-y-2">
                        <label class="block text-sm" for="dissocSel">Desasociar casos</label>
                        <select id="dissocSel" multiple size="4" class="field" [(ngModel)]="disassociateSelection">
                          @for (cand of associatedCases(); track cand.id) {
                            <option [value]="cand.id">
                              {{ short(cand.id) }} · {{ cand.product?.name ?? 'asociado' }}
                            </option>
                          }
                        </select>
                        <button type="button" class="btn-primary" [disabled]="acting() || disassociateSelection.length === 0" (click)="disassociate()">
                          {{ acting() ? 'Procesando…' : 'Desasociar' }}
                        </button>
                      </div>
                    }
                  </div>
                }

                @if (actionError()) {
                  <div class="text-sm mt-4" style="color: var(--color-danger)">{{ actionError() }}</div>
                }
                @if (actionMessage()) {
                  <div class="text-sm mt-4" style="color: var(--color-success)">{{ actionMessage() }}</div>
                }
              </section>
            } @else {
              <section class="card">
                <h2 class="text-sm font-semibold mb-1">Sin acciones para ti</h2>
                <p class="text-xs text-mut">
                  No puedes actuar sobre este caso en este momento. Puede ser
                  por su estado o porque tu actividad no incluye la operación.
                </p>
              </section>
            }

            <section class="card">
              <h2 class="text-sm font-semibold mb-3">Avisos vinculados</h2>
              @if (notices().length === 0) {
                <p class="text-sm text-mut">No hay avisos para este producto.</p>
              } @else {
                <div class="space-y-2">
                  @for (notice of notices(); track notice.id) {
                    <button type="button" class="notice-link" (click)="goToNotice(notice.id)">
                      <span class="text-sm">{{ notice.title }}</span>
                      <span class="text-xs text-mut">{{ notice.type }}</span>
                    </button>
                  }
                </div>
              }
            </section>
          </div>

          <div class="lg:col-span-2">
            <section class="card">
              <h2 class="text-sm font-semibold mb-4">
                Historial · {{ history().length }} evento(s)
              </h2>
              @if (history().length === 0) {
                <p class="text-sm text-mut">No hay eventos registrados para este EPC.</p>
              } @else {
                <ol class="timeline">
                  @for (entry of history(); track entry.id) {
                    <li class="timeline-item">
                      <div class="timeline-marker"></div>
                      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span class="text-sm font-medium">{{ entryLabel(entry) }}</span>
                        <span class="text-xs text-mut">{{ actorName(entry.actorId) }}</span>
                      </div>
                      <div class="text-xs text-mut mt-1">
                        {{ date(entry.eventTime) }}
                        @if (entry.bizTransactionId) {
                          <span>
                            · {{ txnTypeLabel(entry.bizTransactionType) }}:
                            {{ entry.bizTransactionId }}
                          </span>
                        }
                      </div>
                      @if (entry.disposition) {
                        <div class="text-xs mt-1">
                          Disposición:
                          <span
                            class="badge"
                            [style.background]="statusColor(entry.disposition)"
                            [style.color]="'#0b0f17'"
                          >
                            {{ statusLabel(entry.disposition) }}
                          </span>
                        </div>
                      }
                    </li>
                  }
                </ol>
              }
            </section>
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
      padding: 1.25rem;
    }
    .field {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid var(--color-border);
      background: var(--color-bg);
      color: var(--color-ink);
      font-size: 0.875rem;
    }
    .field:focus {
      outline: none;
      border-color: var(--color-accent);
    }
    .btn-primary {
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      background: var(--color-accent);
      color: var(--color-accent-ink);
      font-size: 0.875rem;
      font-weight: 600;
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-secondary {
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface-2);
      color: var(--color-ink);
      font-size: 0.875rem;
      font-weight: 600;
    }
    .btn-secondary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .camera-video {
      width: 100%;
      max-height: 240px;
      margin-top: 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid var(--color-border);
      background: #0b0f17;
      object-fit: contain;
    }
    .case-row {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      align-items: flex-start;
      text-align: left;
      padding: 0.6rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface-2);
      color: var(--color-ink);
    }
    .case-row:hover {
      border-color: var(--color-accent);
    }
    .case-row-static {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 0.3rem;
      align-items: flex-start;
      padding: 0.6rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface-2);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .notice-link {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      text-align: left;
      padding: 0.6rem 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid var(--color-border);
      background: var(--color-surface-2);
      color: var(--color-ink);
    }
    .notice-link:hover {
      border-color: var(--color-accent);
    }
    .timeline {
      list-style: none;
      margin: 0;
      padding: 0 0 0 1.25rem;
      position: relative;
      border-left: 1px solid var(--color-border);
    }
    .timeline-item {
      position: relative;
      padding: 0 0 1.25rem 0.75rem;
    }
    .timeline-item:last-child {
      padding-bottom: 0;
    }
    .timeline-marker {
      position: absolute;
      left: -1.55rem;
      top: 0.25rem;
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 9999px;
      background: var(--color-accent);
      border: 2px solid var(--color-surface);
    }
  `,
})
export class Trace implements OnInit, AfterViewChecked, OnDestroy {
  private readonly api = inject(Api);
  private readonly auth = inject(Auth);
  private readonly directory = inject(Directory);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private cameraVideo = viewChild<ElementRef<HTMLVideoElement>>('cameraVideo');

  query = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly epc = signal<Epc | null>(null);
  readonly history = signal<EpcHistoryEntry[]>([]);
  readonly notices = signal<Notice[]>([]);
  readonly myCases = signal<Epc[]>([]);
  readonly results = signal<Epc[]>([]);
  readonly searchedItems = signal<SearchItem[]>([]);

  // Etiqueta QR del gemelo (FR-1204): se genera en el cliente a partir del
  // URN completo cuando el caso carga, para imprimirse como etiqueta física.
  // Es el mismo QR que la cámara de esta página puede escanear (FR-602).
  readonly qrUrl = signal<string | null>(null);

  readonly myActorId = signal<string | null>(null);
  readonly myOperations = signal<ReadonlySet<string>>(new Set());
  readonly acting = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly actionMessage = signal<string | null>(null);

  // Receiving by label (FR-602/FR-D5): the actor reads the physical label —
  // manual entry is the primary flow, the browser camera is optional and
  // only fills the field. The server is the one that validates the EPC.
  receiveInput = '';
  readonly receiving = signal(false);
  readonly receiveError = signal<string | null>(null);
  readonly receiveMessage = signal<string | null>(null);
  readonly cameraActive = signal(false);
  readonly cameraError = signal<string | null>(null);

  private stream: MediaStream | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private rafId = 0;

  shipDestinations: ActorSummary[] = [];
  shipDestination = '';
  invoiceNumber = '';
  invoiceRecipient = '';
  poNumber = '';
  desadvNumber = '';
  bolNumber = '';
  inspectionResult: 'passed' | 'failed' = 'passed';
  packSelection: string[] = [];
  unpackSelection: string[] = [];
  associateSelection: string[] = [];
  disassociateSelection: string[] = [];

  private readonly resolvedActors = new Set<string>();

  ngOnInit(): void {
    this.auth
      .refreshMe()
      .then((me) => {
        this.myActorId.set(me.actor?.id ?? me.user.actorId);
        this.myOperations.set(new Set(me.actor?.operations ?? []));
        this.loadDestinations();
      })
      .catch(() => {
        this.myActorId.set(null);
        this.myOperations.set(new Set());
      });

    void this.loadCases();

    const epc = this.route.snapshot.queryParamMap.get('epc');
    if (epc) {
      this.query = epc;
      this.load(epc);
    }
  }

  ngAfterViewChecked(): void {
    const epc = this.epc();
    const ids = new Set<string>();
    if (epc) {
      for (const id of [
        epc.producerActorId,
        epc.ownerActorId,
        epc.custodianActorId,
        epc.destinationActorId,
      ]) {
        if (id) ids.add(id);
      }
    }
    for (const entry of this.history()) {
      ids.add(entry.actorId);
    }
    ids.forEach((id) => {
      if (!this.resolvedActors.has(id)) {
        this.resolvedActors.add(id);
        void this.directory.get(id);
      }
    });
  }

  lookup(): void {
    const q = this.query.trim();
    if (!q) {
      this.error.set('Ingresa un EPC, SKU, producto o lote.');
      return;
    }
    this.error.set(null);
    this.actionError.set(null);
    this.actionMessage.set(null);
    this.results.set([]);
    this.searchedItems.set([]);

    if (q.startsWith('urn:')) {
      this.load(q);
      return;
    }

    this.busy.set(true);
    this.api
      .searchEpcs(q)
      .then((res: EpcSearchResult) => {
        this.busy.set(false);
        this.searchedItems.set(res.items);
        if (res.cases.length === 0) {
          this.epc.set(null);
          this.history.set([]);
          this.notices.set([]);
          if (res.items.length === 0) {
            this.error.set(
              'No se encontraron casos ni productos con ese criterio.',
            );
          } else {
            this.error.set(
              'No hay casos rastreables para ese criterio, pero sí existen en tu catálogo.',
            );
          }
          return;
        }
        if (res.cases.length === 1) {
          this.query = res.cases[0].id;
          this.load(res.cases[0].id);
          return;
        }
        this.results.set(res.cases);
      })
      .catch((err: unknown) => {
        this.busy.set(false);
        this.error.set(this.messageFrom(err, 'No se pudo completar la búsqueda.'));
      });
  }

  load(urn: string): void {
    this.busy.set(true);
    this.error.set(null);
    this.actionError.set(null);
    this.actionMessage.set(null);
    this.results.set([]);
    this.searchedItems.set([]);
    this.epc.set(null);
    this.history.set([]);
    this.notices.set([]);
    this.qrUrl.set(null);

    Promise.all([this.api.getEpc(urn), this.api.getHistory(urn)])
      .then(([epc, history]) => {
        this.epc.set(epc);
        this.history.set(history);
        // FR-1204: el QR codifica el URN exacto del gemelo; si el encoder
        // fallara, el gemelo sigue siendo utilizable sin etiqueta.
        toDataURL(epc.id, {
          width: 320,
          margin: 2,
          errorCorrectionLevel: 'M',
        })
          .then((url) => this.qrUrl.set(url))
          .catch(() => this.qrUrl.set(null));
        if (epc.productId) {
          this.api
            .listNotices(epc.productId)
            .then((notices) => this.notices.set(notices))
            .catch(() => this.notices.set([]));
        }
      })
      .catch((err: unknown) => {
        this.error.set(this.messageFrom(err, 'EPC no encontrado o sin acceso.'));
      })
      .finally(() => this.busy.set(false));
  }

  anyAction(): boolean {
    return (
      this.canShip() ||
      this.canInvoice() ||
      this.canPo() ||
      this.canDesadv() ||
      this.canBol() ||
      this.canInspect() ||
      this.canPack() ||
      this.canUnpack() ||
      this.canAssociate() ||
      this.canDisassociate()
    );
  }

  canShip(): boolean {
    const twin = this.epc();
    return (
      !!twin &&
      twin.status === 'active' &&
      this.isCustodian(twin) &&
      this.hasOperation('object:shipping')
    );
  }

  // Receiving is not an action on a twin loaded from a list (FR-D5): it is
  // performed by reading the physical EPC label, from its own card.
  canReceive(): boolean {
    return this.hasOperation('object:receiving');
  }

  canInvoice(): boolean {
    const twin = this.epc();
    return (
      !!twin && this.isOwner(twin) && this.hasOperation('transaction:inv')
    );
  }

  canPo(): boolean {
    const twin = this.epc();
    return (
      !!twin && !this.isOwner(twin) && this.hasOperation('transaction:po')
    );
  }

  canDesadv(): boolean {
    const twin = this.epc();
    return (
      !!twin && this.isCustodian(twin) && this.hasOperation('transaction:desadv')
    );
  }

  canBol(): boolean {
    const twin = this.epc();
    return (
      !!twin && this.isCustodian(twin) && this.hasOperation('transaction:bol')
    );
  }

  canInspect(): boolean {
    const twin = this.epc();
    return (
      !!twin &&
      this.isCustodian(twin) &&
      this.hasOperation('object:inspecting')
    );
  }

  canPack(): boolean {
    const twin = this.epc();
    return (
      !!twin &&
      this.isCustodian(twin) &&
      this.hasOperation('object:packing') &&
      this.packCandidates().length > 0
    );
  }

  canUnpack(): boolean {
    const twin = this.epc();
    return (
      !!twin &&
      this.isCustodian(twin) &&
      this.hasOperation('object:unpacking') &&
      this.unpackChildren().length > 0
    );
  }

  canAssociate(): boolean {
    const twin = this.epc();
    return (
      !!twin &&
      this.isCustodian(twin) &&
      this.hasOperation('association:ADD') &&
      this.associateCandidates().length > 0
    );
  }

  canDisassociate(): boolean {
    const twin = this.epc();
    return (
      !!twin &&
      this.isCustodian(twin) &&
      this.hasOperation('association:DELETE') &&
      this.associatedCases().length > 0
    );
  }

  hasOperation(code: string): boolean {
    return this.myOperations().has(code);
  }

  packCandidates(): Epc[] {
    const twin = this.epc();
    if (!twin) return [];
    return this.myCases().filter(
      (c) =>
        c.id !== twin.id &&
        c.productId === twin.productId &&
        c.parentId === null,
    );
  }

  unpackChildren(): Epc[] {
    const twin = this.epc();
    if (!twin) return [];
    return this.myCases().filter((c) => c.parentId === twin.id);
  }

  associateCandidates(): Epc[] {
    const twin = this.epc();
    if (!twin) return [];
    const already = new Set(this.associatedCases().map((c) => c.id));
    return this.myCases().filter((c) => c.id !== twin.id && !already.has(c.id));
  }

  associatedCases(): Epc[] {
    const twin = this.epc();
    if (!twin) return [];
    const ids = this.associatedIds();
    const byId = new Map(this.myCases().map((c) => [c.id, c]));
    return [...ids].map((id) => byId.get(id)).filter((c): c is Epc => !!c);
  }

  private associatedIds(): Set<string> {
    const twin = this.epc();
    const ids = new Set<string>();
    if (!twin) return ids;

    for (const entry of this.history()) {
      if (entry.type !== 'AssociationEvent') continue;

      const payload = entry.payload as {
        action?: string;
        epcList?: string[];
        associatedEPCs?: string[];
      };
      const action = payload.action;
      const related = payload.associatedEPCs ?? [];

      if (entry.role === 'observed') {
        for (const id of related) {
          if (action === 'ADD') ids.add(id);
          else if (action === 'DELETE') ids.delete(id);
        }
      } else if (entry.role === 'associated') {
        const target = payload.epcList?.[0];
        if (target) {
          if (action === 'ADD') ids.add(target);
          else if (action === 'DELETE') ids.delete(target);
        }
      }
    }

    return ids;
  }

  ship(): void {
    const twin = this.epc();
    if (!twin || !this.shipDestination) return;
    void this.runAction(
      () => this.api.shipEpc(twin.id, { destinationActorId: this.shipDestination }),
      'Caso enviado.',
    );
  }

  receiveByLabel(): void {
    const epcId = this.receiveInput.trim();
    if (!epcId) {
      this.receiveError.set('Ingresa o escanea el EPC de la etiqueta física.');
      return;
    }

    this.receiving.set(true);
    this.receiveError.set(null);
    this.receiveMessage.set(null);

    this.api
      .receiveEpc(epcId)
      .then((epc) => {
        this.receiveMessage.set('Caso recibido.');
        this.receiveInput = '';
        if (this.epc()?.id === epc.id) {
          this.load(epc.id);
        }
        void this.loadCases();
      })
      .catch((err: unknown) => {
        this.receiveError.set(
          this.messageFrom(err, 'No se pudo completar la recepción.'),
        );
      })
      .finally(() => this.receiving.set(false));
  }

  toggleCamera(): void {
    if (this.cameraActive()) {
      this.stopCamera();
      return;
    }
    void this.startCamera();
  }

  private async startCamera(): Promise<void> {
    this.cameraError.set(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError.set('Este navegador no permite usar la cámara.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      this.stream = stream;

      const video = this.cameraVideo()?.nativeElement;
      if (!video) {
        this.stopCamera();
        return;
      }
      video.srcObject = stream;
      await video.play();

      this.cameraActive.set(true);
      this.canvas = document.createElement('canvas');
      this.scanLoop();
    } catch (err: unknown) {
      this.stopCamera();
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError') {
        this.cameraError.set('Permiso de cámara denegado.');
      } else if (name === 'NotFoundError') {
        this.cameraError.set('No se encontró una cámara.');
      } else {
        this.cameraError.set('No se pudo abrir la cámara.');
      }
    }
  }

  private scanLoop(): void {
    const video = this.cameraVideo()?.nativeElement;
    const canvas = this.canvas;
    if (!this.cameraActive() || !video || !canvas) return;

    if (video.readyState >= 2 && video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code && code.data.trim()) {
          this.onQrRead(code.data.trim());
          return;
        }
      }
    }

    this.rafId = requestAnimationFrame(() => this.scanLoop());
  }

  private onQrRead(data: string): void {
    this.receiveInput = data;
    this.cameraError.set(null);
    this.stopCamera();
  }

  private stopCamera(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    const video = this.cameraVideo()?.nativeElement;
    if (video) {
      video.srcObject = null;
    }
    this.canvas = null;
    this.cameraActive.set(false);
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  invoice(): void {
    const twin = this.epc();
    if (!twin) return;
    const bizTransactionId = this.invoiceNumber.trim();
    if (!bizTransactionId) {
      this.actionError.set('Ingresa el número de factura.');
      return;
    }
    const recipient = this.invoiceRecipient.trim();
    void this.runAction(
      () =>
        this.api.invoiceEpc(twin.id, {
          bizTransactionId,
          ownershipTransferTo: recipient || undefined,
        }),
      'Factura registrada.',
    );
  }

  purchaseOrder(): void {
    void this.runTransaction('po', this.poNumber, 'Orden de compra registrada.');
  }

  despatchAdvice(): void {
    void this.runTransaction('desadv', this.desadvNumber, 'Aviso de despacho registrado.');
  }

  billOfLading(): void {
    void this.runTransaction('bol', this.bolNumber, 'Guía de remisión registrada.');
  }

  inspect(): void {
    const twin = this.epc();
    if (!twin) return;
    void this.runAction(
      () => this.api.inspectEpc(twin.id, { result: this.inspectionResult }),
      this.inspectionResult === 'failed'
        ? 'Inspección registrada como no conforme.'
        : 'Inspección registrada como conforme.',
    );
  }

  pack(): void {
    void this.runAggregate('pack', this.packSelection, 'Casos empaquetados.');
  }

  unpack(): void {
    void this.runAggregate('unpack', this.unpackSelection, 'Casos desempaquetados.');
  }

  associate(): void {
    const twin = this.epc();
    if (!twin || this.associateSelection.length === 0) return;
    void this.runAction(
      () => this.api.associateEpc(twin.id, { relatedEpcs: this.associateSelection }),
      'Asociación registrada.',
    );
  }

  disassociate(): void {
    const twin = this.epc();
    if (!twin || this.disassociateSelection.length === 0) return;
    void this.runAction(
      () => this.api.disassociateEpc(twin.id, { relatedEpcs: this.disassociateSelection }),
      'Asociación eliminada.',
    );
  }

  actorName(id: string | null): string {
    return this.directory.name(id);
  }

  // Scoped twin views (FR-605) hide upstream actors: null renders as «—».
  actorLabel(id: string | null): string {
    return id ? this.directory.name(id) : '—';
  }

  statusColor(status: EpcStatus): string {
    return STATUS_STYLES[status] ?? '#8a97ad';
  }

  statusLabel(status: EpcStatus): string {
    return STATUS_LABELS[status] ?? status.replace('_', ' ');
  }

  typeLabel(type: EventType): string {
    return TYPE_LABELS[type] ?? type;
  }

  txnTypeLabel(type: BizTransactionType | null): string {
    return type ? (BIZ_TXN_TYPE_LABELS[type] ?? type) : '';
  }

  entryLabel(entry: EpcHistoryEntry): string {
    const parts = [
      this.typeLabel(entry.type),
      ROLE_LABELS[entry.role] ?? entry.role,
    ];
    if (entry.bizStep) {
      parts.push(BIZ_STEP_LABELS[entry.bizStep] ?? entry.bizStep);
    }
    return parts.join(' · ');
  }

  date(value: string | null): string {
    if (!value) {
      return '—';
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return value;
    }
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  short(urn: string): string {
    const parts = urn.split(':');
    return parts[parts.length - 1].slice(0, 8);
  }

  goToNotice(noticeId: string): void {
    void this.router.navigate(['/notices'], {
      queryParams: { notice: noticeId },
    });
  }

  private isOwner(twin: Epc): boolean {
    const id = this.myActorId();
    return !!id && twin.ownerActorId === id;
  }

  private isCustodian(twin: Epc): boolean {
    const id = this.myActorId();
    return !!id && twin.custodianActorId === id;
  }

  private isDestination(twin: Epc): boolean {
    const id = this.myActorId();
    return !!id && twin.destinationActorId === id;
  }

  private async loadCases(): Promise<void> {
    try {
      this.myCases.set(await this.api.listEpcs());
    } catch {
      this.myCases.set([]);
    }
  }

  private loadDestinations(): void {
    this.api
      .listActors()
      .then((actors) => {
        this.shipDestinations = actors.filter(
          (a) => a.id !== this.myActorId(),
        );
      })
      .catch(() => {
        this.shipDestinations = [];
      });
  }

  private async runTransaction(
    kind: 'po' | 'desadv' | 'bol',
    number: string,
    successMessage: string,
  ): Promise<void> {
    const twin = this.epc();
    if (!twin) return;
    const bizTransactionId = number.trim();
    if (!bizTransactionId) {
      this.actionError.set('Ingresa el número del documento.');
      return;
    }
    const call =
      kind === 'po'
        ? this.api.purchaseOrderEpc(twin.id, { bizTransactionId })
        : kind === 'desadv'
          ? this.api.despatchAdviceEpc(twin.id, { bizTransactionId })
          : this.api.billOfLadingEpc(twin.id, { bizTransactionId });
    void this.runAction(() => call, successMessage);
  }

  private async runAggregate(
    kind: 'pack' | 'unpack',
    childEpcs: string[],
    successMessage: string,
  ): Promise<void> {
    const twin = this.epc();
    if (!twin || childEpcs.length === 0) return;
    const call =
      kind === 'pack'
        ? this.api.packEpc(twin.id, { childEpcs })
        : this.api.unpackEpc(twin.id, { childEpcs });
    void this.runAction(() => call, successMessage);
  }

  private async runAction(
    action: () => Promise<Epc>,
    successMessage: string,
  ): Promise<void> {
    const twin = this.epc();
    if (!twin) return;

    this.acting.set(true);
    this.actionError.set(null);
    this.actionMessage.set(null);

    try {
      await action();
      this.actionMessage.set(successMessage);
      this.invoiceNumber = '';
      this.invoiceRecipient = '';
      this.poNumber = '';
      this.desadvNumber = '';
      this.bolNumber = '';
      this.shipDestination = '';
      this.packSelection = [];
      this.unpackSelection = [];
      this.associateSelection = [];
      this.disassociateSelection = [];
      this.load(twin.id);
      await this.loadCases();
    } catch (err: unknown) {
      this.actionError.set(this.messageFrom(err, 'No se pudo completar la acción.'));
    } finally {
      this.acting.set(false);
    }
  }

  private messageFrom(err: unknown, fallback: string): string {
    const message = (err as { error?: { message?: unknown } })?.error?.message;
    if (Array.isArray(message)) {
      return message.join(' ');
    }
    return typeof message === 'string' ? message : fallback;
  }
}
