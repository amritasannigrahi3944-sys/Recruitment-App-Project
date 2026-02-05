{{- define "recruitment.name" -}}
recruitment
{{- end }}

{{- define "recruitment.fullname" -}}
{{ .Release.Name }}-{{ include "recruitment.name" . }}
{{- end }}
