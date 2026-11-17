import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { AdminRoute } from "../../../lib/adminRoute";
import type { AdminProductMode } from "../../clients/mode";
import type { ClientRow, CrmLead } from "../../clients/api";
import { openHostPortalPreview, pmGet, pmPost } from "../../clients/api";
import "./clientsDesign.css";
import { AddClientSheet, type ClientForm } from "./AddClientSheet";
import { ClientDetails } from "./ClientDetails";
import { ClientList } from "./ClientList";
import { HubShell } from "./HubShell";
import { MonthEarnings } from "./MonthEarnings";
import { OwnerStatementView } from "./OwnerStatement";
import { Toast, useIsPhone } from "./uiBits";

const FONT = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";

export type ClientsHubAppProps = {
  route: AdminRoute;
  setRoute: (next: AdminRoute, opts?: { push?: boolean }) => void;
  onModeChange: (mode: AdminProductMode, patch?: Partial<AdminRoute>) => void;
};

export function ClientsHubApp({ route, setRoute, onModeChange }: ClientsHubAppProps) {
  const phone = useIsPhone();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [form, setForm] = useState<ClientForm>({
    name: "",
    email: "",
    phone: "",
    status: "active",
  });
  const [prefillLeadId, setPrefillLeadId] = useState("");
  const [ownerStatement, setOwnerStatement] = useState<{
    clientId: string;
    clientName: string;
    month: string;
  } | null>(null);

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT;
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const loadClients = useCallback(async () => {
    setLoadError("");
    const data = await pmGet<{ clients: ClientRow[] }>("clients");
    setClients(data.clients ?? []);
  }, []);

  useEffect(() => {
    loadClients().catch((err) =>
      setLoadError(err instanceof Error ? err.message : "Couldn’t load clients."),
    );
  }, [loadClients]);

  const loadCrmLeads = useCallback(async () => {
    setLeadsLoading(true);
    try {
      const res = await fetch("/api/admin/leads", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { leads?: CrmLead[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Could not load leads.");
      setLeads(data.leads ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load leads.");
      setLeads([]);
    } finally {
      setLeadsLoading(false);
    }
  }, []);

  const navOps = useCallback(
    (
      patch: Partial<
        Pick<
          AdminRoute,
          "opsTab" | "propertyId" | "clientId" | "clientEdit" | "createClient" | "hstClientId"
        >
      >,
      push = true,
    ) => {
      setRoute(
        {
          ...route,
          mode: "ops",
          opsTab: patch.opsTab ?? route.opsTab,
          propertyId: patch.propertyId === undefined ? null : patch.propertyId,
          clientId: patch.clientId === undefined ? null : patch.clientId,
          clientEdit: Boolean(patch.clientEdit),
          createClient: Boolean(patch.createClient),
          hstClientId: patch.hstClientId === undefined ? null : patch.hstClientId,
        },
        { push },
      );
    },
    [route, setRoute],
  );

  const editingClient =
    route.clientId && route.clientEdit
      ? clients.find((c) => c.id === route.clientId) || null
      : null;
  const monthClient =
    route.clientId && !route.clientEdit && !route.createClient
      ? clients.find((c) => c.id === route.clientId) || null
      : null;

  useEffect(() => {
    if (editingClient) {
      setForm({
        name: editingClient.name,
        email: editingClient.email,
        phone: editingClient.phone,
        status: editingClient.status,
      });
    }
  }, [editingClient?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- sync when opening a client

  useEffect(() => {
    if (!route.createClient) return;
    setForm({ name: "", email: "", phone: "", status: "active" });
    setPrefillLeadId("");
    void loadCrmLeads();
    try {
      const raw = sessionStorage.getItem("mrg_prefill_client_lead");
      if (raw) {
        const prefill = JSON.parse(raw) as {
          id?: string;
          name?: string;
          email?: string;
          phone?: string;
        };
        if (prefill) {
          setForm({
            name: prefill.name || "",
            email: prefill.email || "",
            phone: prefill.phone || "",
            status: "active",
          });
          if (prefill.id) setPrefillLeadId(prefill.id);
        }
        sessionStorage.removeItem("mrg_prefill_client_lead");
      }
    } catch {
      /* ignore */
    }
  }, [route.createClient, loadCrmLeads]);

  const onNavigate = (id: string) => {
    if (id === "crm") {
      onModeChange("crm");
      return;
    }
    if (id === "copilot") {
      onModeChange("copilot");
      return;
    }
    if (id === "onboarding") {
      onModeChange("onboarding");
      return;
    }
    if (id === "dashboard") {
      onModeChange("ops", { opsTab: "sops" });
      return;
    }
    if (id === "team") {
      navOps({ opsTab: "employees" });
      return;
    }
    if (id === "properties") {
      navOps({ opsTab: "properties" });
      return;
    }
    if (id === "revenue") {
      navOps({ opsTab: "month" });
      return;
    }
    if (id === "settings") {
      navOps({ opsTab: "settings" });
      return;
    }
    if (id === "clients") {
      navOps({ opsTab: "clients" });
    }
  };

  const openCreate = () => {
    setForm({ name: "", email: "", phone: "", status: "active" });
    navOps({ opsTab: "clients", createClient: true });
  };

  const openEdit = (c: ClientRow) => {
    setForm({
      name: c.name,
      email: c.email,
      phone: c.phone,
      status: c.status,
    });
    navOps({ opsTab: "clients", clientId: c.id, clientEdit: true });
  };

  const saveClient = async (sendContract = false) => {
    setBusy(true);
    setLoadError("");
    try {
      if (route.createClient) {
        const res = await pmPost<{ client: ClientRow }>("clients", {
          op: "create",
          ...form,
        });
        await loadClients();
        if (sendContract && res.client?.id) {
          try {
            sessionStorage.setItem(
              `mrg_invite_${res.client.id}`,
              JSON.stringify({
                open: true,
                step: "form",
                kind: "new",
                templateId: "",
                fields: [],
                name: form.name,
                email: form.email,
                phone: form.phone,
                saveAsTemplate: false,
              }),
            );
          } catch {
            /* quota */
          }
          navOps({ opsTab: "clients", clientId: res.client.id, clientEdit: true }, false);
          setToast(`Client ${res.client.name} created · Pick a template or PDF to send contract`);
        } else {
          navOps({ opsTab: "clients" }, false);
          setToast(`Client ${res.client?.name || form.name} created`);
        }
      } else if (editingClient) {
        await pmPost("clients", {
          op: "update",
          id: editingClient.id,
          ...form,
        });
        await loadClients();
        setToast(`Saved ${form.name}`);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const deleteClient = async () => {
    if (!editingClient) return;
    setBusy(true);
    setLoadError("");
    try {
      await pmPost("clients", { op: "delete", id: editingClient.id });
      navOps({ opsTab: "clients" }, false);
      await loadClients();
      setToast("Client deleted");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not delete client.");
    } finally {
      setBusy(false);
    }
  };

  const preview = (c: ClientRow) => {
    openHostPortalPreview(c.id).catch((e) =>
      setLoadError(e instanceof Error ? e.message : "Could not open preview."),
    );
  };

  let body: ReactNode = null;
  let fab: { label: string; onClick: () => void } | null = null;
  let bare = false;

  if (route.clientId && !route.createClient && !editingClient && !monthClient && !ownerStatement) {
    body = phone ? (
      <p className="meta" style={{ padding: 24 }}>
        {loadError || "Loading client…"}
      </p>
    ) : (
      <>
        <div className="head">
          <div>
            <div className="date">Clients</div>
            <h1>Loading…</h1>
          </div>
        </div>
        <div className="content">
          <p className="meta">{loadError || "Loading client…"}</p>
        </div>
      </>
    );
  } else if (ownerStatement) {
    bare = true;
    body = (
      <OwnerStatementView
        clientId={ownerStatement.clientId}
        clientName={ownerStatement.clientName}
        initialMonth={ownerStatement.month}
        phone={phone}
        onBack={() => setOwnerStatement(null)}
        onError={setLoadError}
      />
    );
  } else if (monthClient) {
    body = (
      <MonthEarnings
        clientId={monthClient.id}
        clientName={monthClient.name}
        clientActive={monthClient.status === "active"}
        phone={phone}
        onBack={() => navOps({ opsTab: "clients" })}
        onOpenDetails={() => navOps({ opsTab: "clients", clientId: monthClient.id, clientEdit: true })}
        onOpenProperty={(propertyId) => navOps({ opsTab: "properties", propertyId })}
        onOpenHstWorklist={(id) => navOps({ opsTab: "month", hstClientId: id })}
        onOpenStatement={(clientId, month) =>
          setOwnerStatement({ clientId, clientName: monthClient.name, month })
        }
        onToast={setToast}
        onError={setLoadError}
      />
    );
  } else if (editingClient) {
    body = (
      <ClientDetails
        client={editingClient}
        form={form}
        setForm={setForm}
        phone={phone}
        busy={busy}
        saving={busy}
        error={loadError}
        onDismissError={() => setLoadError("")}
        onRetry={() => void loadClients()}
        onBack={() => navOps({ opsTab: "clients" })}
        onSave={() => void saveClient(false)}
        onDelete={deleteClient}
        onOpenMonth={() => navOps({ opsTab: "clients", clientId: editingClient.id })}
        onOpenProperties={() => {
          try {
            sessionStorage.setItem("mrg_properties_filter_client", editingClient.id);
          } catch {
            /* ignore */
          }
          navOps({ opsTab: "properties" });
        }}
        onToast={setToast}
        onError={setLoadError}
      />
    );
  } else {
    fab = phone ? { label: "Add client", onClick: openCreate } : null;
    body = (
      <ClientList
        clients={clients}
        phone={phone}
        error={loadError}
        onDismissError={() => setLoadError("")}
        onRetry={() => void loadClients()}
        onAdd={openCreate}
        onOpen={openEdit}
        onPreview={preview}
      />
    );
  }

  return (
    <div className={`mrgc${phone ? " is-phone" : ""}`}>
      {bare ? (
        body
      ) : (
        <HubShell active="clients" onNavigate={onNavigate} phone={phone} fab={fab}>
          {body}
        </HubShell>
      )}
      {route.createClient ? (
        <AddClientSheet
          phone={phone}
          busy={busy}
          form={form}
          setForm={setForm}
          leads={leads}
          leadsLoading={leadsLoading}
          initialLeadId={prefillLeadId}
          onCancel={() => navOps({ opsTab: "clients" })}
          onSaveOnly={() => void saveClient(false)}
          onSaveAndSend={() => void saveClient(true)}
        />
      ) : null}
      <Toast message={toast} />
    </div>
  );
}
