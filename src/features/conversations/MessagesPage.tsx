import { useParams } from "react-router-dom"
import { ConversationList } from "@/features/conversations/components/ConversationList"
import { Thread } from "@/features/conversations/components/Thread"
import { Card, CardContent } from "@/components/ui/card"
import { ErrorBoundary, SectionFallback } from "@/components/shared/ErrorBoundary"

export default function MessagesPage() {
  const { conversationId } = useParams<{ conversationId?: string }>()
  const validConversationId =
    conversationId && conversationId !== "undefined" ? conversationId : undefined

  if (!validConversationId) {
    return (
      <div className="flex flex-col gap-4">
        <div className="mt-4">
          <h1 className="font-display text-xl font-bold tracking-[-0.02em]">
            Messages
          </h1>
          <p className="text-sm text-muted-foreground">
            Negotiate listings and keep offers in one place.
          </p>
        </div>
        <Card className="mt-4 rounded-card">
          <CardContent className="p-2">
            <ErrorBoundary fallback={<SectionFallback />}>
              <ConversationList />
            </ErrorBoundary>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[18rem_1fr]">
      <Card className="hidden max-h-[calc(100svh-6rem)] overflow-y-auto no-scrollbar rounded-card md:block">
        <CardContent className="p-2">
          <ErrorBoundary fallback={<SectionFallback />}>
            <ConversationList activeId={validConversationId} />
          </ErrorBoundary>
        </CardContent>
      </Card>
      <ErrorBoundary fallback={<SectionFallback />}>
        <Thread conversationId={validConversationId} />
      </ErrorBoundary>
    </div>
  )
}
