import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Plus, Trash2 } from "lucide-react"
import type { z } from "zod"
import { useCategories } from "@/features/categories/queries"
import { useAddCategory, useDeleteCategory } from "@/features/admin/mutations"
import { adminCategoryCreateSchema } from "@/features/admin/schemas"
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader"
import { StatusPill } from "@/features/admin/components/StatusPill"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { slugify } from "@/lib/utils"
import { getErrorMessage } from "@/lib/api/errors"
import type { Category } from "@/types"

type AddCategoryValues = z.infer<typeof adminCategoryCreateSchema>

export default function AdminCategoriesPage() {
  const { data: categories, isLoading } = useCategories()
  const addCategory = useAddCategory()
  const deleteCategory = useDeleteCategory()
  const [deleteTarget, setDeleteTarget] = React.useState<Category | null>(null)

  const form = useForm<AddCategoryValues>({
    resolver: zodResolver(adminCategoryCreateSchema),
    defaultValues: { name: "" },
  })

  const watchedName = form.watch("name")
  const slugPreview = watchedName.trim() ? slugify(watchedName) : ""

  const onSubmit = (values: AddCategoryValues) => {
    addCategory.mutate(values, {
      onSuccess: () => {
        toast.success("Category created")
        form.reset({ name: "" })
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title="Categories"
        subtitle="Manage marketplace categories and their slugs"
      />

      <Card className="rounded-card border-border">
        <CardContent className="p-4">
          <Form {...form}>
            <form
              id="category-form"
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-3"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="grid max-w-md">
                    <FormLabel>New category name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g. Collectibles" />
                    </FormControl>
                    <FormDescription>
                      Slug preview:{" "}
                      <span className="font-mono text-[10px] text-mut">
                        /categories/
                        {slugPreview || "…"}
                      </span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={addCategory.isPending}
                >
                  <Plus />
                  Add category
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="rounded-card border-border">
        <CardContent className="p-2">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <ul className="flex flex-col">
              {(categories ?? []).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 border-b border-line-2 px-3 py-2.5 last:border-0"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-ink">{c.name}</span>
                    <span className="font-mono text-[10px] text-mut">
                      /categories/{c.slug}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className="border-transparent bg-soft font-mono text-[10px] text-mut">
                      {c.postCount ?? 0} posts
                    </Badge>
                    <StatusPill status={c.slug === "digital" ? "draft" : "published"} />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Delete ${c.name}`}
                      className="text-err hover:bg-err-soft"
                      onClick={() => setDeleteTarget(c)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Removing <span className="font-medium text-ink">{deleteTarget?.name}</span>{" "}
              unassigns it from any listings that use it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteCategory.isPending}
              onClick={() => {
                if (!deleteTarget) return
                deleteCategory.mutate(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
