"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { deleteBrandAction } from "@/lib/actions/brands";

export function DeleteBrandButton({ brand_id }: { brand_id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteBrandAction(brand_id);
        toast.success("Brand deleted");
        router.push("/brands");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  };

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="destructive" size="default" className="gap-2">
            <Trash2 className="size-4" />
            Delete
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this brand?</DialogTitle>
          <DialogDescription>
            All ads linked to this brand will also be deleted. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button variant="destructive" onClick={handleDelete} disabled={pending} className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Delete brand
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
