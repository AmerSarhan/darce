<script lang="ts">
  import Modal from "$lib/components/ui/Modal.svelte";
  import Button from "$lib/components/ui/Button.svelte";
  import { tauriInvoke } from "$lib/utils/ipc";

  let show = $state(false);
  let email = $state("");
  let sending = $state(false);
  let done = $state(false);

  // Check if user already signed up
  $effect(() => {
    const signed = localStorage.getItem("darce_beta_signup");
    if (!signed) show = true;
  });

  async function submit() {
    if (!email.trim() || !email.includes("@")) return;
    sending = true;
    try {
      await tauriInvoke("send_signup_email", { email: email.trim() });
    } catch (e) {
      console.error("Signup email failed:", e);
    }
    localStorage.setItem("darce_beta_signup", email.trim());
    sending = false;
    done = true;
    setTimeout(() => { show = false; }, 1500);
  }

  function skip() {
    localStorage.setItem("darce_beta_signup", "skipped");
    show = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") submit();
  }
</script>

<Modal open={show} title="Welcome to Darce Beta">
  {#if done}
    <div class="text-center py-4">
      <p class="text-[13px] text-zinc-200">You're in. Happy building.</p>
    </div>
  {:else}
    <p class="text-[12px] text-zinc-400 mb-3">
      Darce is in early beta. Drop your email to get updates on new features, bug fixes, and the public launch.
    </p>

    <input type="email" bind:value={email} onkeydown={handleKeydown}
      placeholder="you@email.com"
      class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-[12px] text-zinc-100
        placeholder:text-zinc-600 focus:border-accent/40 focus:outline-none mb-3" />

    <div class="flex items-center justify-between">
      <button onclick={skip} class="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors">
        Skip for now
      </button>
      <Button variant="primary" onclick={submit} disabled={sending || !email.includes("@")}>
        {sending ? "..." : "Join Beta"}
      </Button>
    </div>
  {/if}
</Modal>
